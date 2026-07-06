import difflib
import re
import traceback
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.conversation_agent import ConversationAgent
from services.session_manager import get_session, update_field, get_progress, complete
from services.validation import validate_field

logger = logging.getLogger("formmitra")

router = APIRouter()


def _normalize_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def _resolve_field_name(field_name: str, fields: list):
    """
    The model is instructed to echo back the exact field_name it was
    given, but occasionally returns a close-but-not-identical name
    (different casing/underscores, a trailing word dropped, etc).
    Previously that silently dropped the value entirely. Try an exact
    match first, then fall back to normalized/fuzzy matching so a
    same-turn correction like this doesn't just vanish.
    """

    if not field_name:
        return None

    for f in fields:
        if f["name"] == field_name:
            return f["name"]

    normalized_target = _normalize_name(field_name)

    for f in fields:
        if _normalize_name(f["name"]) == normalized_target:
            return f["name"]

    candidates = [f["name"] for f in fields]
    close = difflib.get_close_matches(field_name, candidates, n=1, cutoff=0.75)

    if close:
        return close[0]

    return None


@router.websocket("/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):

    await websocket.accept()

    session = get_session(session_id)

    if session is None:
        await websocket.send_json({
            "message": "Invalid session.",
            "fields": [],
            "completed": False,
            "progress": 0,
        })
        return

    agent = ConversationAgent()

    fields = session["fields"]

    percent, completed, _ = get_progress(session_id)

    # No scripted greeting here — the frontend already shows one right
    # after a successful upload (see /upload in routes.py), which is the
    # moment that actually knows fields were just populated. Sending
    # something here too would either repeat it (every reconnect) or
    # race the upload response depending on which arrives first.
    await websocket.send_json({
        "message": "",
        "fields": fields,
        "completed": completed,
        "progress": percent,
    })

    try:

        while True:

            payload = await websocket.receive_json()

            # Each message is handled in its own try/except so a single
            # malformed transcript or a transient LLM failure can no
            # longer tear down the whole websocket connection (that
            # previously ended the session for the rest of the
            # conversation, forcing a full reconnect/re-upload).
            try:
                transcript = payload.get("transcript", "")
                language = payload.get("language", "en-IN")

                # session["fields"] may have been replaced (e.g. a fresh
                # upload on the same session) since we grabbed the
                # reference above — always work off the live list so we
                # never mutate/read a stale snapshot.
                live_session = get_session(session_id)

                if live_session is None:
                    await websocket.send_json({
                        "message": "Session expired.",
                        "fields": [],
                        "completed": False,
                        "progress": 0,
                    })
                    break

                fields = live_session["fields"]

                logger.info(f"Transcript received: {transcript!r}")

                result = agent.process(
                    transcript=transcript,
                    fields=fields,
                    language=language,
                )

                message = result.get("message", "")
                field_name = result.get("field_name", "")
                field_value = result.get("field_value", "")

                if field_name and field_value:

                    resolved_name = _resolve_field_name(field_name, fields)

                    if resolved_name is None:
                        logger.warning(f"field_name '{field_name}' not found in session fields")
                    else:
                        field_type = next(
                            (f.get("field_type", "text") for f in fields if f["name"] == resolved_name),
                            "text",
                        )

                        is_valid, normalized_value, error_message = validate_field(
                            field_type, field_value
                        )

                        if is_valid:
                            saved = update_field(session_id, resolved_name, normalized_value)
                            if not saved:
                                logger.warning(f"field_name '{resolved_name}' could not be saved")
                        else:
                            message = error_message

                percent, is_completed, _ = get_progress(session_id)

                if is_completed:
                    complete(session_id)

                await websocket.send_json({
                    "message": message,
                    "fields": fields,
                    "completed": is_completed,
                    "progress": percent,
                })

            except Exception:
                traceback.print_exc()

                try:
                    await websocket.send_json({
                        "message": "Sorry, something went wrong processing that. Please try again.",
                        "fields": fields,
                        "completed": False,
                        "progress": get_progress(session_id)[0],
                    })
                except Exception:
                    break

    except WebSocketDisconnect:

        logger.info(f"Client disconnected: {session_id}")