"use client";

import { useEffect, useRef } from "react";

import speak from "@/hooks/useSpeak";

import { useFormStore } from "@/store/useFormStore";
import { useConversationStore } from "@/store/useConversationStore";

const MAX_RECONNECT_DELAY_MS = 10000;

// Feature — debounce: ignore an identical transcript re-sent within
// this window. Voice input and the text box both call sendTranscript,
// and speech recognition can occasionally fire the same final
// transcript twice — without this, that becomes two LLM requests for
// the same content.
const DUPLICATE_TRANSCRIPT_WINDOW_MS = 2000;

// The backend sends this exact string as a connection-handshake status,
// not a conversational turn — it should never show up as a chat bubble.
// Every reconnect (dev server restart, brief network drop, etc.) would
// otherwise spam the transcript with a new "Connected Successfully"
// message each time.
const CONNECTION_STATUS_MESSAGE = "Connected Successfully";

export default function useConversation() {
  const socket = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const intentionalClose = useRef(false);
  const lastTranscript = useRef<{ text: string; at: number } | null>(null);

  const sessionId = useFormStore((state) => state.sessionId);
  const setFields = useFormStore((state) => state.setFields);
  const setProgress = useFormStore((state) => state.setProgress);
  const setCompleted = useFormStore((state) => state.setCompleted);

  const addAIMessage = useConversationStore(
    (state) => state.addAIMessage
  );

  const setThinking = useConversationStore(
    (state) => state.setThinking
  );

  const setSendTranscript = useConversationStore(
    (state) => state.setSendTranscript
  );

  useEffect(() => {
    if (!sessionId) return;

    intentionalClose.current = false;
    reconnectAttempt.current = 0;

    const connect = () => {
      if (socket.current) {
        socket.current.close();
      }

      const ws = new WebSocket(
        `${process.env.NEXT_PUBLIC_WS}/${sessionId}`
      );

      socket.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket Connected");

        reconnectAttempt.current = 0;

        setSendTranscript(
          (text: string, language: string) => {
            const now = Date.now();
            const trimmed = text.trim();

            if (
              lastTranscript.current &&
              lastTranscript.current.text === trimmed &&
              now - lastTranscript.current.at < DUPLICATE_TRANSCRIPT_WINDOW_MS
            ) {
              console.log("Duplicate transcript ignored (debounced):", trimmed);
              return;
            }

            lastTranscript.current = { text: trimmed, at: now };

            console.log("➡ Sending:", text, language);

            ws.send(
              JSON.stringify({
                transcript: text,
                language: language,
              })
            );
          }
        );
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        console.log("🤖 AI:", data);

        const isConnectionStatus = data.message === CONNECTION_STATUS_MESSAGE;

        if (data.message && !isConnectionStatus) {
          addAIMessage(data.message);

          // useSpeak language khud store se read karega
          speak(data.message);
        }

        setThinking(false);

        if (data.fields) {
          setFields(data.fields);
        }

        if (typeof data.progress === "number") {
          setProgress(data.progress);
        }

        if (typeof data.completed === "boolean") {
          setCompleted(data.completed);
        }
      };

      ws.onerror = (err) => {
        console.error("❌ WebSocket Error:", err);
        setThinking(false);
      };

      ws.onclose = () => {
        console.log("❌ WebSocket Closed");

        setSendTranscript(null);

        // Reconnect on unexpected drops (network blip, server restart)
        // with capped exponential backoff. A deliberate close (session
        // change / component unmount) skips this entirely so we never
        // fight the effect's own cleanup.
        if (intentionalClose.current) return;

        const delay = Math.min(
          1000 * 2 ** reconnectAttempt.current,
          MAX_RECONNECT_DELAY_MS
        );

        reconnectAttempt.current += 1;

        reconnectTimer.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      intentionalClose.current = true;

      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }

      socket.current?.close();
    };
  }, [
    sessionId,
    addAIMessage,
    setThinking,
    setFields,
    setProgress,
    setCompleted,
    setSendTranscript,
  ]);
}