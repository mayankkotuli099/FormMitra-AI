from fastapi import APIRouter, UploadFile, File, Form
from PIL import Image
from services.ocr_service import extract_form_fields, mistral_ocr_image_text
from services.stt_service import transcribe_audio
from services.session_manager import (
    create_session,
    get_session,
    update_session_fields,
    set_language,
    get_progress,
)
from services.pdf_builder import build_filled_pdf
from core.config import UPLOAD_FOLDER, GENERATED_FOLDER, MAX_UPLOAD_MB

import uuid
import os
import hashlib
import logging

logger = logging.getLogger("formmitra")

MAX_UPLOAD_BYTES = int(MAX_UPLOAD_MB * 1024 * 1024)

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "tiff", "tif", "bmp", "heic", "heif"}

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pillow_heif = None


def _convert_image_to_pdf(image_path: str, pdf_path: str) -> bool:
    try:
        img = Image.open(image_path)
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(pdf_path, "PDF", resolution=150.0)
        return True
    except Exception as e:
        logger.warning(f"Image-to-PDF conversion failed: {e}")
        return False


def _build_opening_message(fields: list) -> str:
    """
    The first thing the user hears/reads right after a form is
    successfully uploaded — a professional heads-up that the AI is now
    going to ask questions, followed immediately by the first one, so
    the user never has to speak first to get the conversation going.
    """

    missing = [f for f in fields if not (f.get("filled") or f.get("value"))]

    if not missing:
        return (
            "Namaste! This form already looks completely filled in. "
            "Feel free to review it, or tell me if anything needs to change."
        )

    first = missing[0]
    label = first.get("label") or first.get("name", "this field")

    return (
        "Namaste! I'm FormMitra AI. I'll now be asking you a few questions "
        f"to fill out your form — let's begin. What is your {label}?"
    )

router = APIRouter()


@router.post("/session")
async def session():

    session_id = create_session()

    return {
        "session_id": session_id,
    }


@router.get("/session/{session_id}")
async def resume_session(session_id: str):
    """
    Feature 10 — Resume Session. The frontend calls this on load with a
    session_id it remembers from localStorage; if it's still valid the
    full state (fields, pdf, progress) is returned so the UI can
    rehydrate without asking the user to start over.
    """

    session = get_session(session_id)

    if session is None:
        return {
            "success": False,
            "message": "Session not found or expired.",
        }

    percent, completed, _ = get_progress(session_id)

    return {
        "success": True,
        "session_id": session_id,
        "fields": session["fields"],
        "pdf_url": session["pdf_url"],
        "form_name": session["form_name"],
        "language": session["language"],
        "progress": percent,
        "completed": completed,
    }


@router.post("/upload")
async def upload(
    session_id: str = Form(...),
    file: UploadFile = File(...),
):

    session = get_session(session_id)

    if session is None:
        return {
            "success": False,
            "message": "Invalid Session",
        }

    original_name = file.filename or ""
    extension = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""

    is_pdf = extension == "pdf"
    is_image = extension in ALLOWED_IMAGE_EXTENSIONS

    if not is_pdf and not is_image:
        return {
            "success": False,
            "message": "Unsupported file type. Please upload a PDF, JPG, PNG, WEBP, TIFF, BMP, or HEIC/HEIF image.",
        }

    raw_filename = f"{uuid.uuid4()}.{extension}"
    raw_filepath = os.path.join(UPLOAD_FOLDER, raw_filename)

    size = 0
    try:
        with open(raw_filepath, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break

                size += len(chunk)

                if size > MAX_UPLOAD_BYTES:
                    buffer.close()
                    os.remove(raw_filepath)
                    return {
                        "success": False,
                        "message": f"File is too large. Maximum size is {int(MAX_UPLOAD_MB)}MB.",
                    }

                buffer.write(chunk)
    except Exception:
        if os.path.exists(raw_filepath):
            os.remove(raw_filepath)
        return {
            "success": False,
            "message": "Could not read the uploaded file. Please try again.",
        }

    ocr_text_override = None

    if is_pdf:
        # A real PDF must start with the "%PDF-" magic bytes — this
        # catches files that were merely renamed to .pdf.
        with open(raw_filepath, "rb") as f:
            header = f.read(5)

        if header != b"%PDF-":
            os.remove(raw_filepath)
            return {
                "success": False,
                "message": "This doesn't look like a valid PDF file.",
            }

        filename = raw_filename
        filepath = raw_filepath
    else:
        if extension in ("heic", "heif") and pillow_heif is None:
            os.remove(raw_filepath)
            return {
                "success": False,
                "message": "HEIC/HEIF images aren't supported on this server yet. Please upload a JPG, PNG, or WEBP instead.",
            }

        # Run OCR on the original photo/scan, then wrap it in a one-page
        # PDF so the rest of the pipeline (session storage, coordinate
        # detection, "generate filled PDF") needs no changes at all.
        ocr_text_override = mistral_ocr_image_text(raw_filepath)

        filename = f"{uuid.uuid4()}.pdf"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        converted = _convert_image_to_pdf(raw_filepath, filepath)
        os.remove(raw_filepath)

        if not converted:
            return {
                "success": False,
                "message": "Could not read that image. Please try a different photo or scan.",
            }

    # Feature — debounce/dedupe: if this is byte-for-byte the same file
    # this session already ran through OCR (e.g. an accidental double
    # upload, or the same file re-selected), reuse the cached OCR result
    # instead of sending another request to Mistral. Saves API usage and
    # avoids the UI briefly showing fields reset while it re-processes
    # something it already knows.
    with open(filepath, "rb") as f:
        content_hash = hashlib.sha256(f.read()).hexdigest()

    if session.get("last_upload_hash") == content_hash and session.get("last_upload_result"):
        logger.info("Duplicate upload detected — reusing cached OCR result (debounced)")
        result = session["last_upload_result"]
    else:
        result = extract_form_fields(filepath, raw_text_override=ocr_text_override)
        session["last_upload_hash"] = content_hash
        session["last_upload_result"] = result

    if not result.get("supported", True):
        os.remove(filepath)
        return {
            "success": False,
            "message": "Unsupported file type. Please upload a PDF.",
        }

    fields = []

    for key, value in result["schema"].items():

        fields.append(
            {
                "name": key,
                "value": value["value"],
                "label": value.get("label", key),
                "filled": value.get("filled", value["value"] != ""),
                "required": value.get("required", False),
                "field_type": value.get("field_type", "text"),
                "coordinates": value.get("coordinates"),
            }
        )

    pdf_url = f"/uploads/{filename}"

    ok = update_session_fields(
        session_id,
        fields,
        pdf_url,
        filepath=filepath,
        form_name=result.get("form_name", "Government Form"),
    )

    if not ok:
        return {
            "success": False,
            "message": "Invalid Session",
        }

    return {
        "success": True,
        "session_id": session_id,
        "fields": fields,
        "form_name": result.get("form_name", "Government Form"),
        "confidence": result.get("confidence", 0),
        "pdf_url": pdf_url,
        "is_recognized_form": result.get("is_recognized_form", True),
        "opening_message": _build_opening_message(fields),
    }


@router.post("/generate/{session_id}")
async def generate(session_id: str):
    """
    Feature 5 — Generate Filled PDF. Draws every answered field onto the
    original uploaded PDF (using the coordinates OCR detected) and
    returns a download URL for the result.
    """

    session = get_session(session_id)

    if session is None:
        return {
            "success": False,
            "message": "Invalid Session",
        }

    source_path = session.get("filepath")

    if not source_path or not os.path.exists(source_path):
        return {
            "success": False,
            "message": "Original PDF not found for this session.",
        }

    output_filename = f"filled_{session_id}.pdf"
    output_path = os.path.join(GENERATED_FOLDER, output_filename)

    ok = build_filled_pdf(source_path, session["fields"], output_path)

    if not ok:
        return {
            "success": False,
            "message": "Could not generate the filled PDF. Please try again.",
        }

    return {
        "success": True,
        "download_url": f"/generated/{output_filename}",
    }


@router.post("/language/{session_id}")
async def set_session_language(session_id: str, language: str = Form(...)):

    session = get_session(session_id)

    if session is None:
        return {
            "success": False,
            "message": "Invalid Session",
        }

    set_language(session_id, language)

    return {
        "success": True,
    }


@router.post("/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    language: str = Form(...),
):
    """
    Used only for languages the browser's own speech recognition
    doesn't reliably support (see VoiceOrb.tsx) — Hindi/English keep
    using the free, unlimited browser engine and never hit this route.
    """

    audio_bytes = await file.read()

    success, result, limit_reached = transcribe_audio(
        audio_bytes=audio_bytes,
        filename=file.filename or "audio.webm",
        language_code=language,
    )

    if success:
        return {"success": True, "transcript": result}

    return {
        "success": False,
        "message": result,
        "limit_reached": limit_reached,
    }


@router.get("/health")
async def health():

    return {
        "status": "ok",
    }