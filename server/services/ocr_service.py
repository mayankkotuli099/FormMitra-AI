"""
Smart OCR service.

Pipeline:
  1. Extract raw text from the PDF with pdfplumber (unchanged, still works
     without any external API — this is the existing working functionality).
  2. Detect the form type from keywords in the text (PAN / Aadhaar /
     Passport / Driving License / Bank / Income Tax / Scholarship / etc).
  3. Ask Mistral to read the raw text and return a structured list of every
     field it finds on the form: label, current value (if already filled
     in on the form), whether it's required, and a field type
     (used later for validation).
  4. If Mistral is unavailable or returns something unusable, fall back to
     the previous regex-based fixed-label extraction so the feature never
     hard-fails and the app keeps working end-to-end.
"""

import re
import os
import json
import difflib
import logging
import tempfile
import base64

import pdfplumber
from pypdf import PdfReader
from mistralai import Mistral

from core.config import MISTRAL_API_KEY, MISTRAL_MODEL
from services.retry_utils import call_with_retry, USER_FRIENDLY_BUSY_MESSAGE

logger = logging.getLogger("formmitra")

_client = Mistral(api_key=MISTRAL_API_KEY) if MISTRAL_API_KEY else None


# ---------------------------------------------------------------------------
# Form type detection
# ---------------------------------------------------------------------------

FORM_TYPE_KEYWORDS = {
    "PAN Card": ["permanent account number", "income tax department", "pan card"],
    "Aadhaar Card": ["unique identification authority", "aadhaar", "uidai"],
    "Passport Application": ["passport", "ministry of external affairs"],
    "Driving License": ["driving licence", "driving license", "transport department", "learner licence"],
    "Bank Account Form": ["account opening form", "ifsc", "branch name", "kyc", "know your customer"],
    "Income Tax Form": ["income tax return", "assessment year", "form 16", "itr"],
    "Scholarship Form": ["scholarship", "national scholarship portal", "nsp"],
    "Ration Card": ["ration card", "public distribution"],
    "Voter ID": ["election commission", "voter id", "epic no"],
}


def detect_form_type(text: str) -> str:
    lowered = text.lower()

    for form_name, keywords in FORM_TYPE_KEYWORDS.items():
        for kw in keywords:
            if kw in lowered:
                return form_name

    return "Government Form"


# ---------------------------------------------------------------------------
# "Is this actually a form?" heuristic
# ---------------------------------------------------------------------------
#
# Feature — warn (don't block) when an uploaded PDF doesn't look like a
# government form at all — e.g. someone uploads a resume/CV. This is a
# best-effort heuristic, not a hard gate: an unusual-but-genuine form
# wrongly flagged is a worse failure mode than an occasional missed
# warning, so on any doubt we lean towards treating it as a form.

FORM_INDICATOR_KEYWORDS = [
    "government of india", "ministry of", "application form", "declaration",
    "signature of applicant", "date of birth", "father's name", "aadhaar",
    "permanent account number", "form no", "office use only",
    "for official use", "applicant's signature", "district", "pin code",
]

RESUME_INDICATOR_KEYWORDS = [
    "curriculum vitae", "resume", "work experience", "professional summary",
    "career objective", "linkedin.com/in/", "github.com/", "portfolio",
    "certifications", "technical skills", "projects", "objective",
]


def looks_like_a_form(text: str, form_name: str) -> bool:
    # A specific known form (PAN / Aadhaar / Passport / etc.) was already
    # matched by detect_form_type — that's as confident as this gets.
    if form_name != "Government Form":
        return True

    lowered = text.lower()

    form_hits = sum(1 for kw in FORM_INDICATOR_KEYWORDS if kw in lowered)
    resume_hits = sum(1 for kw in RESUME_INDICATOR_KEYWORDS if kw in lowered)

    # Looks distinctly resume/CV-shaped and doesn't show typical form
    # language at all.
    if resume_hits >= 2 and resume_hits > form_hits:
        return False

    return form_hits > 0


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def clean(text: str):
    text = text.replace("\t", " ")
    text = re.sub(r"[ ]+", " ", text)
    return text.strip()


def extract_text(pdf_path: str):
    text = ""

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"

    text = clean(text)

    # A PDF made from a scan/photo (e.g. someone filled the form by hand
    # then scanned or photographed it) has no real text layer at all —
    # pdfplumber finds nothing, so every field looked "empty" even when
    # the form was already partially filled, and the AI started asking
    # from scratch. Detect that case and run real OCR on each page image
    # instead, the same way a direct photo upload is handled.
    if len(text) < 40:
        ocr_text = _ocr_scanned_pdf(pdf_path)
        if ocr_text:
            return ocr_text

    return text


def _ocr_scanned_pdf(pdf_path: str) -> str:
    """
    Renders each page of a scanned/photographed PDF as an image and runs
    real OCR on it (mistral_ocr_image_text), since there's no text layer
    for pdfplumber to read directly.
    """

    if _client is None:
        return ""

    combined = []

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                tmp_path = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
                try:
                    page.to_image(resolution=200).original.save(tmp_path, "PNG")
                    page_text = mistral_ocr_image_text(tmp_path)
                    if page_text:
                        combined.append(page_text)
                finally:
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)
    except Exception as e:
        logger.warning(f"Scanned PDF OCR failed ({e})")
        return ""

    return clean("\n".join(combined))


def mistral_ocr_image_text(image_path: str) -> str:
    """
    Runs Mistral's OCR endpoint on an uploaded photo/scan (JPG, PNG,
    WEBP, HEIC/HEIF, or a single rendered page of a scanned PDF).
    pdfplumber only reads text already embedded in a PDF, so a camera
    photo needs a real OCR pass instead — this returns text in the same
    shape as extract_text() so the rest of the pipeline needs no changes.
    """

    if _client is None:
        return ""

    try:
        ext = image_path.rsplit(".", 1)[-1].lower()
        mime_map = {"jpg": "jpeg", "tif": "tiff"}
        mime = mime_map.get(ext, ext)

        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        response = call_with_retry(
            lambda: _client.ocr.process(
                model="mistral-ocr-latest",
                document={
                    "type": "image_url",
                    "image_url": f"data:image/{mime};base64,{b64}",
                },
            ),
            operation_name="Image OCR",
        )

        text = "\n".join(page.markdown for page in response.pages if page.markdown)
        return clean(text)

    except Exception as e:
        logger.warning(f"Image OCR unavailable ({e})")
        return ""


# ---------------------------------------------------------------------------
# Coordinate detection (Feature 4)
# ---------------------------------------------------------------------------

def extract_words_by_page(pdf_path: str):
    """
    Returns {page_index(0-based): {"words": [...], "width": w, "height": h}}
    """

    pages = {}

    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False)

            pages[page_index] = {
                "words": words,
                "width": page.width,
                "height": page.height,
            }

    return pages


def _normalize_token(word: str) -> str:
    return re.sub(r"[^a-z0-9]", "", word.lower())


def _find_label_coordinates(label: str, pages: dict):
    """
    Locates the printed label on the page and returns a coordinate box
    for where the *value* should be written — just to the right of the
    label, on the same line.

    Matches the FULL sequence of label tokens against consecutive words
    on the page (not just the first token), so a label like
    "Date of Birth" can't lock onto an unrelated word that merely starts
    with "date". A small amount of slack is allowed between tokens to
    absorb pdfplumber splitting punctuation (":", "-") into its own word.
    """

    label_tokens = [_normalize_token(w) for w in label.split()]
    label_tokens = [t for t in label_tokens if t]

    if not label_tokens:
        return None

    for page_index, page_data in pages.items():
        words = page_data["words"]
        normalized_words = [_normalize_token(w["text"]) for w in words]

        for i in range(len(words)):
            if normalized_words[i] != label_tokens[0]:
                continue

            j = i
            matched = 0
            max_span = len(label_tokens) + 3  # slack for stray punctuation tokens

            while j < len(words) and matched < len(label_tokens) and (j - i) < max_span:
                if normalized_words[j] == label_tokens[matched]:
                    matched += 1
                j += 1

            if matched != len(label_tokens):
                continue

            first_label_word = words[i]
            last_label_word = words[j - 1]

            # reject matches that drift onto a different line — a real
            # label's tokens sit on (roughly) the same baseline
            line_height = max(first_label_word["bottom"] - first_label_word["top"], 8)
            if abs(last_label_word["top"] - first_label_word["top"]) > line_height * 1.5:
                continue

            page_width = page_data["width"]
            page_height = page_data["height"]

            font_size = max(round(last_label_word["bottom"] - last_label_word["top"]), 8)

            value_x = last_label_word["x1"] + 8
            value_top = last_label_word["top"]

            # clamp so the value box can never be placed off the page —
            # this was producing overlays that spilled past the right
            # margin or bottom edge on narrow/short pages
            max_width = max(page_width - value_x - 10, 40)
            width = min(max(page_width * 0.28, 90), max_width)
            value_x = min(value_x, max(page_width - width - 5, 0))
            value_top = min(max(value_top, 0), max(page_height - font_size - 4, 0))

            return {
                "page": page_index,
                "x": round(value_x, 1),
                "y": round(value_top, 1),
                "width": round(width, 1),
                "height": round(font_size + 4, 1),
                "font_size": font_size,
                "page_width": round(page_width, 1),
                "page_height": round(page_height, 1),
            }

    return None


def extract_table_cells_by_page(pdf_path: str):
    """
    Many of these forms (see the sample "Field | Value" application form)
    are laid out as an actual table. In that case the right place for an
    answer isn't "a few points right of the label" — it's the sibling
    cell in that same row, which may be far to the right of the label
    and on a different visual line than the word-proximity heuristic
    below assumes. This walks pdfplumber's table detection and returns,
    per page, a list of (label_text, value_cell_bbox) pairs so a field's
    printed label can be matched straight to its actual answer cell.

    Returns {page_index: [(label_text, (x0, top, x1, bottom)), ...]}
    """

    tables_by_page = {}

    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages):
            entries = []

            try:
                tables = page.find_tables()
            except Exception:
                tables = []

            for table in tables:
                for row in table.rows:
                    cells = row.cells

                    if len(cells) < 2 or cells[0] is None:
                        continue

                    try:
                        label_text = (page.within_bbox(cells[0]).extract_text() or "").strip()
                    except Exception:
                        label_text = ""

                    if not label_text:
                        continue

                    value_bbox = next((c for c in cells[1:] if c is not None), None)

                    if value_bbox is None:
                        continue

                    entries.append((label_text, value_bbox))

            if entries:
                tables_by_page[page_index] = entries

    return tables_by_page


def _match_table_label(label: str, entries: list):
    """
    Finds the best-matching (label_text, bbox) entry for a field's label
    among a page's detected table rows. Exact normalized match wins
    outright; otherwise falls back to fuzzy similarity so minor OCR/label
    wording differences ("Full Name" vs "Full Name:") still resolve.
    """

    target = _normalize_token(label)

    if not target:
        return None

    best_bbox = None
    best_score = 0.0

    for candidate_label, bbox in entries:
        candidate = _normalize_token(candidate_label)

        if not candidate:
            continue

        if candidate == target:
            return bbox

        score = difflib.SequenceMatcher(None, target, candidate).ratio()

        if score > best_score:
            best_score = score
            best_bbox = bbox

    return best_bbox if best_score >= 0.75 else None


def _coords_from_table_cell(bbox, page_index: int, page_data: dict):
    x0, top, x1, bottom = bbox

    page_width = page_data["width"]
    page_height = page_data["height"]

    cell_height = max(bottom - top, 10)
    font_size = max(min(round(cell_height * 0.5), 14), 8)

    x = x0 + 4
    y = top + max((cell_height - font_size) / 2, 2)
    width = max(x1 - x0 - 8, 20)

    # keep it inside both the cell and the physical page
    width = min(width, max(page_width - x - 5, 20))
    x = min(x, max(page_width - width - 5, 0))
    y = min(max(y, 0), max(page_height - font_size - 2, 0))

    return {
        "page": page_index,
        "x": round(x, 1),
        "y": round(y, 1),
        "width": round(width, 1),
        "height": round(font_size + 4, 1),
        "font_size": font_size,
        "page_width": round(page_width, 1),
        "page_height": round(page_height, 1),
    }


def attach_coordinates(schema: dict, pdf_path: str) -> dict:
    try:
        pages = extract_words_by_page(pdf_path)
    except Exception as e:
        print("Coordinate extraction failed:", e)
        return schema

    try:
        table_cells = extract_table_cells_by_page(pdf_path)
    except Exception as e:
        print("Table extraction failed:", e)
        table_cells = {}

    # Two distinct fields occasionally resolve to the same printed label
    # (e.g. "Name" and "Applicant Name" both matching the same words),
    # which previously made both values draw on top of each other on the
    # generated PDF. Track claimed boxes per page so only the first field
    # keeps a given spot; later collisions are left without coordinates
    # rather than overwriting the first field's value.
    claimed = set()

    for field in schema.values():
        coords = None

        for page_index, entries in table_cells.items():
            bbox = _match_table_label(field["label"], entries)

            if bbox is not None:
                page_data = pages.get(page_index)
                if page_data:
                    coords = _coords_from_table_cell(bbox, page_index, page_data)
                break

        if coords is None:
            coords = _find_label_coordinates(field["label"], pages)

        if coords:
            box_key = (coords["page"], round(coords["x"]), round(coords["y"]))

            if box_key in claimed:
                coords = None
            else:
                claimed.add(box_key)

        field["coordinates"] = coords

    return schema


# ---------------------------------------------------------------------------
# Regex fallback (guarantees the feature never fully fails)
# ---------------------------------------------------------------------------

FALLBACK_PATTERNS = [
    "Applicant Name",
    "Name",
    "Father Name",
    "Mother Name",
    "Date of Birth",
    "DOB",
    "Gender",
    "Aadhaar",
    "PAN",
    "Mobile",
    "Phone",
    "Email",
    "Address",
    "Village",
    "City",
    "District",
    "State",
    "Pincode",
    "Occupation",
    "Income",
]

REQUIRED_LABELS = {
    "applicant name", "name", "father name", "date of birth", "dob",
    "gender", "aadhaar", "pan", "mobile", "phone", "address",
}

FIELD_TYPE_HINTS = {
    "email": "email",
    "mobile": "phone",
    "phone": "phone",
    "aadhaar": "aadhaar",
    "pan": "pan",
    "pincode": "pincode",
    "pin code": "pincode",
    "ifsc": "ifsc",
    "dob": "date",
    "date of birth": "date",
    "income": "number",
}


def _guess_field_type(label: str) -> str:
    lowered = label.lower()
    for hint, field_type in FIELD_TYPE_HINTS.items():
        if hint in lowered:
            return field_type
    return "text"


def _to_key(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")


def _detect_value(label: str, text: str) -> str:
    patterns = [
        rf"{re.escape(label)}\s*[:\-]?\s*(.+)",
        rf"{re.escape(label)}\s*\n(.+)",
    ]

    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            value = m.group(1).strip()
            value = value.split("\n")[0]
            if 0 < len(value) < 80:
                return value

    return ""


def regex_extract(text: str) -> dict:
    schema = {}

    for label in FALLBACK_PATTERNS:
        value = ""

        if re.search(re.escape(label), text, re.IGNORECASE):
            value = _detect_value(label, text)

        key = _to_key(label)

        schema[key] = {
            "label": label,
            "value": value,
            "filled": value != "",
            "required": label.lower() in REQUIRED_LABELS,
            "field_type": _guess_field_type(label),
        }

    return schema


# ---------------------------------------------------------------------------
# Mistral-powered dynamic extraction
# ---------------------------------------------------------------------------

_EXTRACTION_SYSTEM_PROMPT = """
You are an expert at reading Indian government forms (PAN, Aadhaar,
Passport, Driving License, Bank KYC, Income Tax, Scholarship, Ration
Card, Voter ID, etc).

You will be given the raw text extracted from a scanned/uploaded PDF
form. The text may be messy (OCR spacing issues, jumbled column
order) — do your best to reconstruct the actual fields.

Return ONLY a JSON object (no markdown, no commentary) with exactly
one key, "fields", whose value is a JSON array. Each array element
must be an object with exactly these keys:

  "label"      : human readable field label as printed on the form
  "value"      : the value already filled in on the form, or "" if empty
  "required"   : true if this field is typically mandatory on such forms
  "field_type" : one of "text", "date", "email", "phone", "number",
                 "aadhaar", "pan", "pincode", "ifsc", "address"

Rules:
- Include every distinct field you can identify (name, father/mother
  name, DOB, gender, address, phone, email, ID numbers, etc). Do not
  skip fields just because they are empty.
- Do not invent values that are not present in the text.
- Do not duplicate the same field twice.
- If you cannot confidently find any fields, return {"fields": []}.
"""


def mistral_extract(text: str):
    if _client is None:
        return None

    try:
        response = call_with_retry(
            lambda: _client.chat.complete(
                model=MISTRAL_MODEL,
                messages=[
                    {"role": "system", "content": _EXTRACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": f"FORM TEXT:\n---\n{text[:12000]}\n---"},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            ),
            operation_name="OCR field extraction",
        )

        logger.info("OCR Successful")

        raw = response.choices[0].message.content.strip()

        if raw.startswith("```"):
            raw = raw.replace("```json", "").replace("```", "").strip()

        parsed = json.loads(raw)
        data = parsed.get("fields") if isinstance(parsed, dict) else parsed

        if not isinstance(data, list) or len(data) == 0:
            return None

        schema = {}
        seen_keys = set()

        for item in data:
            label = str(item.get("label", "")).strip()
            if not label:
                continue

            value = str(item.get("value", "") or "").strip()
            key = _to_key(label)

            # avoid silently overwriting a distinct field with the same key
            original_key = key
            suffix = 2
            while key in seen_keys:
                key = f"{original_key}_{suffix}"
                suffix += 1
            seen_keys.add(key)

            schema[key] = {
                "label": label,
                "value": value,
                "filled": value != "",
                "required": bool(item.get("required", False)),
                "field_type": item.get("field_type") or _guess_field_type(label),
            }

        return schema if schema else None

    except Exception as e:
        logger.warning(f"OCR field extraction unavailable ({e}); falling back to regex extraction")
        return None


# ---------------------------------------------------------------------------
# Pre-filled PDF form field detection (Bug fix — partially filled PDFs)
# ---------------------------------------------------------------------------
#
# A PDF that already has real AcroForm fields with values (a fillable PDF
# form the user already partially completed) stores those values in the
# form fields themselves, not in the page's rendered text — so
# pdfplumber's extract_text() never sees them. This reads those values
# directly and merges them into the schema as already-filled, without
# ever overwriting a value OCR/the user already has.

def _read_acroform_values(pdf_path: str) -> dict:
    try:
        reader = PdfReader(pdf_path)
        raw_fields = reader.get_fields() or {}
    except Exception as e:
        logger.warning(f"AcroForm read failed ({e})")
        return {}

    values = {}
    for name, field in raw_fields.items():
        value = field.get("/V")
        if value is None:
            continue
        value = str(value).strip()
        if value:
            values[name] = value

    return values


def _merge_prefilled_values(schema: dict, prefilled: dict) -> dict:
    if not prefilled:
        return schema

    normalized_prefilled = {_normalize_token(k): v for k, v in prefilled.items()}

    for field in schema.values():
        if field.get("value"):
            # OCR/text already found a value for this field — never
            # overwrite it with the AcroForm value.
            continue

        label_key = _normalize_token(field["label"])
        match = normalized_prefilled.get(label_key)

        if match is None:
            best_score = 0.0
            for pf_key, pf_val in normalized_prefilled.items():
                score = difflib.SequenceMatcher(None, label_key, pf_key).ratio()
                if score > best_score and score >= 0.8:
                    best_score = score
                    match = pf_val

        if match:
            field["value"] = match
            field["filled"] = True

    return schema


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------

def extract_form_fields(file_path: str, raw_text_override: str = None):
    if not file_path.lower().endswith(".pdf"):
        return {
            "supported": False,
            "form_name": "",
            "confidence": 0,
            "schema": {},
        }

    logger.info("OCR Request Started")

    text = raw_text_override if raw_text_override else extract_text(file_path)

    form_name = detect_form_type(text)

    schema = mistral_extract(text)
    source = "mistral"

    if schema is None:
        schema = regex_extract(text)
        source = "regex_fallback"

    # Merge in any values already sitting in real fillable PDF form
    # fields (AcroForm) — never overwrites a value already found above.
    schema = _merge_prefilled_values(schema, _read_acroform_values(file_path))

    schema = attach_coordinates(schema, file_path)

    filled_count = sum(1 for f in schema.values() if f["filled"])
    total = len(schema) or 1
    confidence = round((filled_count / total) * 60 + 40) if source == "mistral" else 70

    is_recognized_form = looks_like_a_form(text, form_name)

    logger.info(
        f"OCR source={source} form_type={form_name} fields={len(schema)} "
        f"filled={filled_count} recognized_form={is_recognized_form}"
    )

    return {
        "supported": True,
        "form_name": form_name,
        "confidence": confidence,
        "schema": schema,
        "is_recognized_form": is_recognized_form,
    }