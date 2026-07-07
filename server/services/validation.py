"""
Field-level validation for common Indian government-form field types.
Used by the websocket conversation loop before an extracted value is
accepted into the session — invalid values are rejected and the field
is asked again instead of being silently saved.
"""

import re

from typing import Optional

from dateutil import parser as _date_parser

_PATTERNS = {
    "email": re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
    "phone": re.compile(r"^[6-9]\d{9}$"),
    "pan": re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$"),
    "aadhaar": re.compile(r"^\d{12}$"),
    "pincode": re.compile(r"^\d{6}$"),
    "ifsc": re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$"),
    "date": re.compile(r"^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$"),
}

_ERROR_MESSAGES = {
    "email": "That doesn't look like a valid email address. Could you repeat it?",
    "phone": "That doesn't look like a valid 10-digit Indian mobile number.",
    "pan": "PAN should be 10 characters like ABCDE1234F. Could you repeat it?",
    "aadhaar": "Aadhaar number should be 12 digits. Could you repeat it?",
    "pincode": "PIN code should be 6 digits.",
    "ifsc": "IFSC code should look like SBIN0001234.",
    "date": "That doesn't look like a valid date. Please say it as DD/MM/YYYY.",
}


def _normalize(field_type: str, value: str) -> str:
    value = value.strip()

    if field_type in ("pan", "ifsc"):
        value = value.upper().replace(" ", "")

    if field_type in ("aadhaar", "phone", "pincode"):
        value = re.sub(r"[\s\-]", "", value)

    return value


def _normalize_date(value: str) -> Optional[str]:
    """
    Accepts a date of birth (or any date field) either typed numerically
    (17/06/2026) or spoken naturally the way someone would actually say it
    out loud — "17 June 2026", "June 17 2026", "17th June 2026" — and
    returns it normalized to DD/MM/YYYY. Returns None if the value doesn't
    contain a recognizable date at all, so the caller can fall back to
    asking the user to repeat it.

    dayfirst=True so an ambiguous all-numeric date like 5/6/2025 is read
    as 5 June (Indian convention) rather than May 6th.
    """

    value = value.strip()

    if not value:
        return None

    try:
        parsed = _date_parser.parse(value, dayfirst=True, fuzzy=True)
    except (ValueError, OverflowError):
        return None

    return parsed.strftime("%d/%m/%Y")


def validate_field(field_type: str, value: str):
    """
    Returns (is_valid: bool, normalized_value: str, error_message: str|None)
    Unknown field types and free text always pass through untouched.
    """

    if not value:
        return False, value, "I didn't catch that. Could you say it again?"

    field_type = (field_type or "text").lower()

    if field_type not in _PATTERNS:
        return True, value.strip(), None

    if field_type == "date":
        normalized_date = _normalize_date(value)

        if normalized_date:
            return True, normalized_date, None

        return False, value, _ERROR_MESSAGES["date"]

    normalized = _normalize(field_type, value)
    pattern = _PATTERNS[field_type]

    if pattern.match(normalized):
        return True, normalized, None

    return False, value, _ERROR_MESSAGES.get(field_type, "That value doesn't look right. Could you repeat it?")