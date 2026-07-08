"""
Speech-to-text for Indian regional languages via Sarvam AI's REST API.

The browser's own SpeechRecognition (used for Hindi/English on the
frontend, see VoiceOrb.tsx) already works well and costs nothing, so
this is only called as a fallback for languages the browser doesn't
reliably support — Gujarati, Tamil, Telugu, Bengali, Marathi, Kannada,
Malayalam, Punjabi, Odia, Assamese. Keeping the split this way means a
limited trial API key is only spent on the languages that actually
need it.
"""

import logging

import requests

from core.config import SARVAM_API_KEY

logger = logging.getLogger("formmitra")

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"

# Sarvam's trial tier is credit-based rather than a literal
# midnight-reset daily quota, but from the user's point of view "ran
# out of credits for today, try later" is the honest, understandable
# message — shown whenever Sarvam reports the key is out of quota or
# rate-limited.
LIMIT_REACHED_MESSAGE = (
    "Aaj ke liye voice limit khatam ho gaya hai. Kripya thodi der baad "
    "try karein, ya neeche type karke apna jawab bhejein."
)

NOT_CONFIGURED_MESSAGE = (
    "Voice input for this language isn't set up yet. Please type your "
    "answer instead."
)

GENERIC_ERROR_MESSAGE = (
    "Voice recognition hit a problem. Please try again or type your answer."
)

NO_SPEECH_MESSAGE = "Didn't catch that — please try speaking again."


def transcribe_audio(audio_bytes: bytes, filename: str, language_code: str):
    """
    Returns (success: bool, transcript_or_message: str, limit_reached: bool)

    On success: (True, "<transcript text>", False)
    On failure: (False, "<user-facing message>", <whether it was a quota/limit hit>)
    """

    if not SARVAM_API_KEY:
        logger.warning("SARVAM_API_KEY not configured — skipping Sarvam STT")
        return False, NOT_CONFIGURED_MESSAGE, False

    try:
        response = requests.post(
            SARVAM_STT_URL,
            headers={"api-subscription-key": SARVAM_API_KEY},
            files={"file": (filename, audio_bytes, "audio/wav")},
            data={
                "model": "saarika:v2.5",
                "language_code": language_code,
            },
            timeout=30,
        )
    except requests.RequestException:
        logger.exception("Sarvam STT request failed")
        return False, GENERIC_ERROR_MESSAGE, False

    # 429 = explicit rate limit. Some trial keys instead return 403 once
    # credits run out (indistinguishable from a real auth failure by
    # status code alone) — since a key that was working moments ago is
    # far more likely to have simply run out of credits than to have
    # suddenly become invalid, treat both as the same limit message
    # rather than a scarier generic error.
    if response.status_code in (429, 403):
        logger.warning(f"Sarvam STT quota/limit hit: {response.status_code}")
        return False, LIMIT_REACHED_MESSAGE, True

    if response.status_code != 200:
        logger.warning(
            f"Sarvam STT error {response.status_code}: {response.text[:200]}"
        )
        return False, GENERIC_ERROR_MESSAGE, False

    try:
        data = response.json()
    except ValueError:
        logger.warning("Sarvam STT returned non-JSON response")
        return False, GENERIC_ERROR_MESSAGE, False

    transcript = (data.get("transcript") or "").strip()

    if not transcript:
        return False, NO_SPEECH_MESSAGE, False

    return True, transcript, False