"""
Production-grade retry helper for calls to the Mistral API.

Mistral occasionally returns HTTP 429 ("rate limit exceeded") under
load. That is expected/normal behaviour for a hosted API, not a bug in
this app, so instead of failing the request outright we retry with
exponential backoff:

    attempt 1 -> fail -> wait 1s
    attempt 2 -> fail -> wait 2s
    attempt 3 -> fail -> wait 4s
    attempt 4 -> final attempt

If every attempt fails, the caller gets a clean, user-friendly message
back instead of a raw exception/stack trace.
"""

import time
import logging

logger = logging.getLogger("formmitra")

MAX_RETRIES = 4
BASE_DELAY_SECONDS = 1

USER_FRIENDLY_BUSY_MESSAGE = (
    "The AI service is currently busy. Please wait a few seconds and try again."
)


def _is_rate_limit_error(exc: Exception) -> bool:
    """
    Best-effort detection of a 429 / rate-limit style error across
    however the Mistral SDK happens to surface it (status_code
    attribute, response.status_code, or just the message text).
    """

    status_code = getattr(exc, "status_code", None)
    if status_code == 429:
        return True

    response = getattr(exc, "response", None)
    if response is not None and getattr(response, "status_code", None) == 429:
        return True

    message = str(exc).lower()
    return "429" in message or "rate limit" in message


def call_with_retry(fn, *, operation_name: str = "Mistral request"):
    """
    Calls fn() with exponential-backoff retry on rate-limit errors.

    Returns fn()'s return value on success.
    Raises the last exception if every retry is exhausted (non rate
    limit errors are raised immediately, unchanged, since retrying
    those wouldn't help).
    """

    delay = BASE_DELAY_SECONDS

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if attempt == 1:
                logger.info(f"{operation_name}: request started")
            else:
                logger.info(f"{operation_name}: retry {attempt - 1}/{MAX_RETRIES - 1}")

            result = fn()

            if attempt > 1:
                logger.info(f"{operation_name}: succeeded on retry {attempt - 1}")

            return result

        except Exception as exc:
            is_last_attempt = attempt == MAX_RETRIES

            if not _is_rate_limit_error(exc):
                logger.warning(f"{operation_name}: failed (non-retryable) - {exc}")
                raise

            if is_last_attempt:
                logger.warning(
                    f"{operation_name}: rate limited, all {MAX_RETRIES} attempts exhausted"
                )
                raise

            logger.info(
                f"{operation_name}: rate limited (429), waiting {delay}s before retry"
            )
            time.sleep(delay)
            delay *= 2

    # Unreachable, but keeps type-checkers happy.
    raise RuntimeError(f"{operation_name}: retry loop exited unexpectedly")
