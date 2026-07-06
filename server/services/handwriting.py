"""
Reusable "real handwriting" rendering module.

Draws field values so the generated PDF looks like a person filled the
form by hand with a blue ballpoint pen, instead of plain computer text.

Public API:

    draw_handwritten_text(c, text, x, y, width, height, seed=None, base_font_size=11)

`x, y, width, height` describe the field's bounding box in reportlab's
coordinate space (origin bottom-left, y increases upward) — pdf_builder
already does the OCR-space -> reportlab-space conversion before calling
this, so this module only has to worry about rendering inside that box.

Design notes:
  - Uses a real handwritten TTF font (registered once, lazily) instead
    of faking handwriting with Times/Arial in italic.
  - `seed` controls the randomness. pdf_builder passes one seed per
    generated document (so every field in the same PDF reads as the
    same person's handwriting) that changes on every generation (so two
    PDFs generated from the same data don't look pixel-identical).
  - Text is clipped to the field's box, so nothing overflows.
  - Falls back to a safe built-in font if no handwriting TTF is found,
    so PDF generation can never hard-fail because of a missing font.
"""

import os
import random

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

HANDWRITING_FONT_NAME = "FormMitraHandwriting"

# "Blue ballpoint pen" ink colour.
INK_COLOR = HexColor("#1E4FD1")

_FONT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "fonts"
)
_DEFAULT_FONT_PATH = os.path.join(_FONT_DIR, "Handwriting-Regular.ttf")

# Lets a deployment drop in a nicer font (Caveat / Patrick Hand / Kalam /
# Indie Flower / Shadows Into Light .ttf) without touching any code.
FONT_PATH = os.getenv("HANDWRITING_FONT_PATH", _DEFAULT_FONT_PATH)

_font_ready = False
_use_fallback = False


def _ensure_font_registered():
    """Registers the handwriting TTF with reportlab exactly once."""

    global _font_ready, _use_fallback

    if _font_ready:
        return

    try:
        pdfmetrics.registerFont(TTFont(HANDWRITING_FONT_NAME, FONT_PATH))
        _use_fallback = False
    except Exception as e:
        # Never let a missing/broken font file break PDF generation —
        # degrade gracefully instead of crashing the request.
        print(f"handwriting: could not load '{FONT_PATH}' ({e}); using fallback font")
        _use_fallback = True

    _font_ready = True


def _active_font_name() -> str:
    _ensure_font_registered()
    return "Helvetica-Oblique" if _use_fallback else HANDWRITING_FONT_NAME


def _wrap_text(text: str, font_name: str, font_size: float, max_width: float):
    words = text.split()

    if not words:
        return [""]

    lines = []
    current = words[0]

    for word in words[1:]:
        candidate = f"{current} {word}"
        if pdfmetrics.stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word

    lines.append(current)
    return lines


def draw_handwritten_text(
    c,
    text: str,
    x: float,
    y: float,
    width: float,
    height: float,
    seed=None,
    base_font_size: float = 11,
    max_lines: int = 3,
):
    """
    Draws `text` by hand, in blue ink, inside the (x, y, width, height)
    box on reportlab canvas `c`. No-ops on empty text or a degenerate
    box instead of raising.
    """

    text = "" if text is None else str(text).strip()

    if not text or width <= 1 or height <= 1:
        return

    font_name = _active_font_name()
    rng = random.Random(seed)

    # Handwritten fonts read smaller than printed fonts at the same
    # point size — bump it up a touch, but never larger than the box.
    font_size = max(7.0, min(base_font_size + 2, height - 2, 15.0))

    usable_width = max(width - 4, 10)
    lines = _wrap_text(text, font_name, font_size, usable_width)

    # Shrink to fit if the value is long and the box is short, rather
    # than silently truncating or spilling past the field.
    line_gap = font_size * 1.15
    attempts = 0
    while (len(lines) > max_lines or len(lines) * line_gap > height) and font_size > 6 and attempts < 12:
        font_size -= 0.5
        line_gap = font_size * 1.15
        lines = _wrap_text(text, font_name, font_size, usable_width)
        attempts += 1

    if len(lines) > max_lines:
        lines = lines[:max_lines]

    c.saveState()

    # Clip strictly to the field's box so handwriting can never spill
    # into a neighbouring field or off the page.
    clip_path = c.beginPath()
    clip_path.rect(x, y, width, height)
    c.clipPath(clip_path, stroke=0, fill=0)

    c.setFillColor(INK_COLOR)

    # A gentle, consistent slant per document so every field looks like
    # it was written by the same hand, plus a touch of per-line
    # variation so it doesn't look mechanically uniform.
    doc_slant = rng.uniform(-2.0, 2.0)

    block_height = len(lines) * line_gap
    start_y = y + (height - block_height) / 2 + block_height - line_gap * 0.8

    for line_index, line in enumerate(lines):
        line_y = start_y - line_index * line_gap
        line_rotation = doc_slant + rng.uniform(-0.6, 0.6)

        c.saveState()
        c.translate(x + 2, line_y)
        c.rotate(line_rotation)

        cursor_x = rng.uniform(-0.3, 0.3)

        for ch in line:
            char_size = max(font_size + rng.uniform(-0.4, 0.4), 6.0)
            baseline_wobble = rng.uniform(-0.5, 0.5)

            c.setFont(font_name, char_size)
            c.drawString(cursor_x, baseline_wobble, ch)

            char_width = pdfmetrics.stringWidth(ch, font_name, char_size)
            spacing_jitter = rng.uniform(0.85, 1.2) if ch == " " else rng.uniform(0.95, 1.08)
            cursor_x += char_width * spacing_jitter

        c.restoreState()

    c.restoreState()
