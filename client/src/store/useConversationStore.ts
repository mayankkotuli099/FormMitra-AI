"use client";

import { create } from "zustand";

export interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

interface ConversationStore {
  messages: Message[];

  thinking: boolean;

  // UPDATED
  sendTranscript:
    | ((text: string, language: string) => void)
    | null;

  addUserMessage: (text: string) => void;

  addAIMessage: (text: string) => void;

  setThinking: (value: boolean) => void;

  // UPDATED
  setSendTranscript: (
    fn:
      | ((text: string, language: string) => void)
      | null
  ) => void;

  clear: () => void;
}

export const useConversationStore =
create<ConversationStore>((set, get) => ({

  messages: [
    {
      id: 1,
      role: "assistant",
      text: "👋 Welcome to FormMitra AI",
    },
  ],

  thinking: false,

  sendTranscript: null,

  addUserMessage(text) {

    set({
      messages: [
        ...get().messages,
        {
          id: Date.now(),
          role: "user",
          text,
        },
      ],
    });

  },

  addAIMessage(text) {

    set({
      messages: [
        ...get().messages,
        {
          id: Date.now(),
          role: "assistant",
          text,
        },
      ],
    });

  },

  setThinking(value) {

    set({
      thinking: value,
    });

  },

  setSendTranscript(fn) {

    set({
      sendTranscript: fn,
    });

  },

  clear() {

    set({

      messages: [
        {
          id: 1,
          role: "assistant",
          text: "👋 Welcome to FormMitra AI",
        },
      ],

      thinking: false,

      sendTranscript: null,

    });

  },

}));