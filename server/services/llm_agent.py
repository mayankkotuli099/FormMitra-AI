import json
import logging

from mistralai import Mistral

from core.config import MISTRAL_API_KEY, MISTRAL_MODEL
from services.retry_utils import call_with_retry, USER_FRIENDLY_BUSY_MESSAGE

logger = logging.getLogger("formmitra")

_client = Mistral(api_key=MISTRAL_API_KEY) if MISTRAL_API_KEY else None


SYSTEM_PROMPT = """
You are FormMitra AI, an intelligent Government Form Filling Agent.

You are NOT a chatbot.

Your only job is to help the user complete the uploaded form naturally.

========================
RULES
========================

1. Reply ONLY valid JSON.

2. Never answer like ChatGPT.

3. Never say:
- I don't understand
- Could you repeat
- I cannot help
unless the transcript is completely empty.

4. You already know every field extracted from OCR.

5. Always maintain conversation context.

6. If the user says

"My name is Mayank"

store it in Full Name.

7. If the user says

"Actually my name is Mayank Kotuli"

or

"Correct my name"

or

"Update my name"

or

"Change my name"

then UPDATE the existing Full Name.

8. Detect corrections automatically.

Words like

correct
change
update
replace
actually
sorry
no

mean the user is correcting a previous answer.

9. Never ask for a field that already has a value.

10. Ask only ONE question at a time.

11. After successfully filling a field,
immediately ask the next missing field.

Example

Assistant:
What is your Full Name?

User:
Mayank Kotuli

Assistant:
Great!
I've saved your Full Name as Mayank Kotuli.

Now tell me your Father's Name.

12. If user provides multiple values together

"My name is Mayank.
DOB 12 Jan 2006.
Male."

Extract ALL of them.

13. If user skips a question

"Skip"

Move to next field.

14. If user asks

"What have you filled?"

Summarize every filled field.

15. If user asks

"Change my mobile number"

Update it.

16. Reply in the same language as the user.

17. Never hallucinate values.

18. If all required fields are filled

completed = true

and congratulate the user.

You MUST use the exact field_name given to you in the field lists below.
Never invent a field_name that isn't in those lists.

Return ONLY this JSON, with no markdown fences and no extra commentary

{
    "message":"",
    "field_name":"",
    "field_value":"",
    "completed":false
}
"""


def ask_llm(
    transcript: str,
    fields: list,
    language: str,
):
    known = [f for f in fields if f.get("filled") or f.get("value")]
    missing = [f for f in fields if not (f.get("filled") or f.get("value"))]

    prompt = f"""
Selected Language:
{language}

ALREADY KNOWN fields (do not ask about these again):
{json.dumps(known, indent=2, ensure_ascii=False)}

MISSING fields (ask about these, required ones first):
{json.dumps(missing, indent=2, ensure_ascii=False)}

User Said:
{transcript}

Remember:
Reply ONLY JSON, using the exact field_name from the lists above.
"""

    if _client is None:
        logger.warning("Conversation LLM unavailable: MISTRAL_API_KEY is not configured")
        return {
            "message": "Sorry, I couldn't understand that. Could you say it again?",
            "field_name": "",
            "field_value": "",
            "completed": False,
        }

    try:
        response = call_with_retry(
            lambda: _client.chat.complete(
                model=MISTRAL_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            ),
            operation_name="Conversation turn",
        )

        text = response.choices[0].message.content.strip()

        if text.startswith("```"):
            text = text.replace("```json", "")
            text = text.replace("```", "")
            text = text.strip()

        data = json.loads(text)

        return {
            "message": data.get("message", ""),
            "field_name": data.get("field_name", ""),
            "field_value": data.get("field_value", ""),
            "completed": bool(data.get("completed", False)),
        }

    except Exception as e:
        is_rate_limit = "429" in str(e) or "rate limit" in str(e).lower()
        logger.warning(f"Conversation turn failed: {e}")

        return {
            "message": (
                USER_FRIENDLY_BUSY_MESSAGE
                if is_rate_limit
                else "Sorry, I couldn't understand that. Could you say it again?"
            ),
            "field_name": "",
            "field_value": "",
            "completed": False,
        }
