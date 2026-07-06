"""
Fills a PDF with the values collected during the conversation, using the
per-field coordinates OCR detected (services/ocr_service.attach_coordinates).

Approach: draw a transparent overlay page per PDF page with reportlab
(each field's value positioned at its detected x/y), then merge that
overlay onto the original page with pypdf. Fields with no detected
coordinates are skipped in the overlay (their value still exists in
the session/JSON, they're just not drawn on the visual PDF) instead of
failing the whole generation.
"""

import io
import os
import uuid
import logging

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

from services.handwriting import draw_handwritten_text

logger = logging.getLogger("formmitra")


def build_filled_pdf(source_pdf_path: str, fields: list, output_path: str) -> bool:
    logger.info("Processing PDF")

    if not os.path.exists(source_pdf_path):
        return False

    try:
        reader = PdfReader(source_pdf_path)
    except Exception as e:
        print("pdf_builder: failed to open source PDF:", e)
        return False

    # One seed per generated document: every field in this PDF shares
    # the same handwriting "personality" (see services/handwriting.py),
    # but generating the document again produces a visibly different
    # (still readable) result, per the "never identical handwriting
    # twice" requirement.
    document_seed = uuid.uuid4().int

    num_pages = len(reader.pages)

    # group drawable fields (value present + coordinates known) by page
    by_page = {i: [] for i in range(num_pages)}

    for field in fields:
        value = field.get("value")
        coords = field.get("coordinates")

        if not value or not coords:
            continue

        page_index = coords.get("page", 0)

        if page_index not in by_page:
            continue

        by_page[page_index].append((field, coords))

    writer = PdfWriter()

    for page_index in range(num_pages):
        page = reader.pages[page_index]
        page_fields = by_page.get(page_index, [])

        if page_fields:
            page_width = float(page.mediabox.width)
            page_height = float(page.mediabox.height)

            buffer = io.BytesIO()
            overlay_canvas = canvas.Canvas(buffer, pagesize=(page_width, page_height))

            for field, coords in page_fields:
                value = str(field["value"])
                font_size = max(min(coords.get("font_size", 10), 14), 8)

                # Coordinates were computed against the page dimensions
                # pdfplumber reported at OCR time. pypdf's mediabox is
                # normally identical, but can differ (rotated pages,
                # mismatched crop/media box) — rescale defensively so the
                # overlay still lands in the right place instead of
                # drifting off the visible page.
                ocr_width = coords.get("page_width") or page_width
                ocr_height = coords.get("page_height") or page_height

                scale_x = page_width / ocr_width if ocr_width else 1
                scale_y = page_height / ocr_height if ocr_height else 1

                box_x = coords["x"] * scale_x
                box_width = coords.get("width", 120) * scale_x
                box_height = max(coords.get("height", font_size + 4) * scale_y, font_size + 2)

                # pdfplumber's "top" is measured from the top of the page;
                # reportlab draws from the bottom, so flip the y axis.
                box_top = page_height - (coords["y"] * scale_y)
                box_bottom = box_top - box_height

                # keep the drawn box within the physical page bounds
                box_x = min(max(box_x, 0), max(page_width - 5, 0))
                box_bottom = min(max(box_bottom, 0), max(page_height - box_height, 0))
                box_width = min(box_width, max(page_width - box_x - 2, 10))

                # a stable per-field seed derived from the document seed
                # + this field's own position, so re-running generation
                # for the SAME document reshuffles every field together
                # (still one consistent "hand"), while identical labels
                # across different documents don't coincidentally match.
                field_seed = hash((document_seed, page_index, round(box_x), round(box_top)))

                draw_handwritten_text(
                    overlay_canvas,
                    value[:120],
                    x=box_x,
                    y=box_bottom,
                    width=box_width,
                    height=box_height,
                    seed=field_seed,
                    base_font_size=font_size,
                )

            logger.info("Rendering Handwriting")

            overlay_canvas.save()
            buffer.seek(0)

            overlay_reader = PdfReader(buffer)
            page.merge_page(overlay_reader.pages[0])

        writer.add_page(page)

    try:
        with open(output_path, "wb") as f:
            writer.write(f)
    except Exception as e:
        print("pdf_builder: failed to write output PDF:", e)
        return False

    logger.info("PDF Generated Successfully")
    return True