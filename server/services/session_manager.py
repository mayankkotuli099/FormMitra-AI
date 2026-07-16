from typing import Dict
import time
import uuid

from core.config import SESSION_TTL_MINUTES

_sessions: Dict[str, dict] = {}

_SESSION_TTL_SECONDS = SESSION_TTL_MINUTES * 60


def _touch(session: dict):
    session["last_active"] = time.time()


def cleanup_expired_sessions():
    """
    Sessions used to live in memory forever, which is a slow, unbounded
    leak on any long-running server. Anything untouched for longer than
    SESSION_TTL_MINUTES is evicted. Called lazily on session creation and
    can also be scheduled periodically (see main.py startup task).
    """

    now = time.time()

    expired = [
        session_id
        for session_id, session in _sessions.items()
        if now - session.get("last_active", now) > _SESSION_TTL_SECONDS
    ]

    for session_id in expired:
        _sessions.pop(session_id, None)

    return len(expired)


def create_session():

    cleanup_expired_sessions()

    session_id = str(uuid.uuid4())

    _sessions[session_id] = {

        "fields": [],

        "pdf_url": "",

        "filepath": "",

        "form_name": "",

        "language": "en-IN",

        "completed": False,

        "last_active": time.time(),

    }

    return session_id


def get_session(session_id):

    session = _sessions.get(session_id)

    if session is not None:
        _touch(session)

    return session


def update_session_fields(
    session_id,
    fields,
    pdf_url,
    filepath="",
    form_name="",
):

    session = _sessions.get(session_id)

    if session is None:

        return False

    # Merge instead of blind-overwrite. If /upload fires again on a
    # session that already has answers (e.g. the user re-selects the
    # same file, or drags it in again after the debounce window), the
    # incoming `fields` come straight from a fresh OCR pass and are
    # blank/original — previously collected conversation answers must
    # not be wiped out by that. For any field name that already had a
    # value in this session, keep it unless the new field actually
    # brings its own value.
    existing_by_name = {f["name"]: f for f in (session.get("fields") or [])}

    merged_fields = []

    for field in fields:
        existing = existing_by_name.get(field.get("name"))
        incoming_has_value = field.get("filled") or field.get("value")

        if existing and (existing.get("filled") or existing.get("value")) and not incoming_has_value:
            merged = dict(field)
            merged["value"] = existing.get("value")
            merged["filled"] = True
            merged_fields.append(merged)
        else:
            merged_fields.append(field)

    session["fields"] = merged_fields

    session["pdf_url"] = pdf_url

    if filepath:
        session["filepath"] = filepath

    if form_name:
        session["form_name"] = form_name

    session["completed"] = False

    _touch(session)

    return True


def set_language(session_id, language):

    session = _sessions.get(session_id)

    if session:
        session["language"] = language
        _touch(session)


def update_field(
    session_id,
    field_name,
    value,
):

    session = _sessions.get(session_id)

    if session is None:

        return False

    for field in session["fields"]:

        if field["name"] == field_name:

            field["value"] = value
            field["filled"] = value != ""

            _touch(session)

            return True

    return False


def get_progress(session_id):
    """
    Returns (percent, completed, next_missing_field).
    Required fields count double toward completion so the assistant
    prioritises them; falls back to all fields if none are marked
    required (keeps old forms, which had no `required` key, working).
    """

    session = _sessions.get(session_id)

    if session is None or not session["fields"]:
        return 0, False, None

    fields = session["fields"]

    required_fields = [f for f in fields if f.get("required")]
    tracked = required_fields if required_fields else fields

    filled = [f for f in tracked if f.get("filled") or f.get("value")]

    percent = round((len(filled) / len(tracked)) * 100) if tracked else 100
    completed = percent >= 100

    next_missing = None
    for f in tracked:
        if not (f.get("filled") or f.get("value")):
            next_missing = f
            break

    return percent, completed, next_missing


def complete(session_id):

    session = _sessions.get(session_id)

    if session:

        session["completed"] = True