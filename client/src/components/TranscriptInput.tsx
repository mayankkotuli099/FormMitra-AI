"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import { useConversationStore } from "@/store/useConversationStore";
import { useLanguageStore } from "@/store/useLanguageStore";

export default function TranscriptInput() {
  const [text, setText] = useState("");

  const language = useLanguageStore((state) => state.language);

  const addUserMessage = useConversationStore(
    (state) => state.addUserMessage
  );

  const setThinking = useConversationStore((state) => state.setThinking);

  const submit = () => {
    if (!text.trim()) return;

    const sendTranscript = useConversationStore.getState().sendTranscript;

    if (!sendTranscript) {
      console.error("WebSocket not connected");
      return;
    }

    addUserMessage(text);
    setThinking(true);
    sendTranscript(text, language);
    setText("");
  };

  return (
    <div className="surface p-5">
      <div className="flex gap-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Or type your answer..."
          className="flex-1 bg-[#0d0d0d] border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/40 transition-colors"
        />

        <button
          onClick={submit}
          className="btn-primary px-5 flex items-center justify-center"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}