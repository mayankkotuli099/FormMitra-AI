"use client";

import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";

import { useConversationStore } from "@/store/useConversationStore";

export default function ConversationPanel() {
  const { messages, thinking } = useConversationStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  return (
    <div className="surface p-6">
      <h2 className="text-lg font-semibold mb-5">Conversation</h2>

      <div className="space-y-4 h-[380px] overflow-y-auto pr-1">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
                <Bot size={14} className="text-black" />
              </div>
            )}

            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-white text-black"
                  : "bg-[#1a1a1a] text-white border border-border"
              }`}
            >
              {message.text}
            </div>

            {message.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-border flex items-center justify-center shrink-0">
                <User size={14} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
              <Bot size={14} className="text-black" />
            </div>

            <div className="bg-[#1a1a1a] border border-border rounded-2xl px-4 py-3 flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}