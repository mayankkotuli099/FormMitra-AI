from services.llm_agent import ask_llm


class ConversationAgent:

    def process(
        self,
        transcript: str,
        fields: list,
        language: str,
    ):

        return ask_llm(
            transcript=transcript,
            fields=fields,
            language=language,
        )