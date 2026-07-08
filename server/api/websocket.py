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

# Shown instead of ever calling the LLM when the user talks before
# uploading a form (fields is still empty). Without this, the model was
# given an empty known/missing list and — despite the system prompt only
# ever *illustrating* "What is your Full Name?" as an example, not an
# instruction to use when there's no form — it would fall back to
# improvising that exact generic flow rather than saying there's simply
# nothing to fill in yet. This is a deterministic guard instead: no form,
# no LLM call, just a direct nudge to upload one, in the user's language.
#
# Best-effort translations — good enough to be understood, but not
# reviewed by native speakers for every language. Worth a native-speaker
# pass before relying on these for anything more than this one message.
NO_FORM_MESSAGES = {
    "en-IN": "Please upload your form first — then I can help you fill it out.",
    "hi-IN": "कृपया पहले अपना फॉर्म अपलोड करें, फिर मैं आपकी मदद करूंगा।",
    "bn-IN": "অনুগ্রহ করে প্রথমে আপনার ফর্ম আপলোড করুন, তারপর আমি আপনাকে সাহায্য করব।",
    "gu-IN": "કૃપા કરી પહેલા તમારું ફોર્મ અપલોડ કરો, પછી હું તમારી મદદ કરીશ.",
    "mr-IN": "कृपया आधी तुमचा फॉर्म अपलोड करा, मग मी तुम्हाला मदत करेन.",
    "ta-IN": "முதலில் உங்கள் படிவத்தை பதிவேற்றவும், பிறகு நான் உதவுகிறேன்.",
    "te-IN": "దయచేసి ముందుగా మీ ఫారమ్‌ని అప్‌లోడ్ చేయండి, తర్వాత నేను సహాయం చేస్తాను.",
    "kn-IN": "ದಯವಿಟ್ಟು ಮೊದಲು ನಿಮ್ಮ ಫಾರ್ಮ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ, ನಂತರ ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.",
    "ml-IN": "ദയവായി ആദ്യം നിങ്ങളുടെ ഫോം അപ്‌ലോഡ് ചെയ്യുക, പിന്നീട് ഞാൻ സഹായിക്കാം.",
    "pa-IN": "ਕਿਰਪਾ ਕਰਕੇ ਪਹਿਲਾਂ ਆਪਣਾ ਫਾਰਮ ਅੱਪਲੋਡ ਕਰੋ, ਫਿਰ ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਕਰਾਂਗਾ।",
    "or-IN": "ଦୟାକରି ପ୍ରଥମେ ଆପଣଙ୍କର ଫର୍ମ ଅପଲୋଡ୍ କରନ୍ତୁ, ତାପରେ ମୁଁ ସାହାଯ୍ୟ କରିବି।",
    "as-IN": "অনুগ্ৰহ কৰি প্ৰথমে আপোনাৰ ফৰ্ম আপল’ড কৰক, তাৰ পাছত মই সহায় কৰিম।",
}


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

                if not fields:
                    # Nothing uploaded yet in this session — don't waste
                    # an LLM call (or risk it improvising a generic
                    # "what's your name" flow); just tell the user what
                    # to do next.
                    await websocket.send_json({
                        "message": NO_FORM_MESSAGES.get(
                            language, NO_FORM_MESSAGES["en-IN"]
                        ),
                        "fields": [],
                        "completed": False,
                        "progress": 0,
                    })
                    continue

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