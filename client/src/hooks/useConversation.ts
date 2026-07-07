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
  // Deliberately NOT a single persistent useRef shared across every
  // reconnect. Only lastTranscript needs to survive across the whole
  // component lifetime (it's just a debounce window). The reconnect
  // machinery (socket / intentionalClose / reconnectAttempt / reconnectTimer)
  // is created fresh inside each effect run instead, scoped to that run's
  // sessionId — see the useEffect below for why.
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

    // Scoped to THIS effect run (i.e. this sessionId) only. Previously
    // these lived in useRefs shared across every reconnect, which meant a
    // fast session change (Start New Form, or navigating back from
    // Credits and getting a new session) could let the OLD socket's async
    // onclose fire *after* the new effect run had already reset
    // intentionalClose to false — so the old, now-stale connection would
    // schedule its own stray reconnect to the old session, alongside the
    // fresh connection to the new one. Two live sockets both writing
    // fields/progress into the store is exactly the "opens and closes,
    // fields flicker" symptom, and a stray reconnect to an old/expired
    // session is exactly the "WebSocket Error: {}" on the way back from
    // Credits. Keeping this state local to each effect run means an old
    // run's callbacks can never step on a newer run's state.
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let intentionalClose = false;

    const connect = () => {
      if (intentionalClose) return;

      const ws = new WebSocket(
        `${process.env.NEXT_PUBLIC_WS}/${sessionId}`
      );

      socket = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket Connected");

        reconnectAttempt = 0;

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
        // Deliberately console.warn, not console.error. A WebSocket
        // "error" event is, by browser design, an empty/non-descriptive
        // Event — the real reason always arrives via onclose right
        // after this, which is what actually drives reconnect logic
        // below. console.error here would additionally pop Next.js's
        // dev-mode red error overlay on every transient blip (a page
        // navigating away mid-connection, a dev-server hot reload, a
        // brief network drop) even though the app already recovers
        // gracefully from all of those on its own.
        console.warn("⚠️ WebSocket error (see onclose for the real reason):", err);
        setThinking(false);
      };

      ws.onclose = () => {
        console.log("❌ WebSocket Closed");

        setSendTranscript(null);

        // Reconnect on unexpected drops (network blip, server restart)
        // with capped exponential backoff. A deliberate close (session
        // change / component unmount) skips this entirely so we never
        // fight the effect's own cleanup. Because intentionalClose lives
        // in this effect run's own closure now (not a shared ref), a
        // stale/old run can never have its flag overwritten by a newer run.
        if (intentionalClose) return;

        const delay = Math.min(
          1000 * 2 ** reconnectAttempt,
          MAX_RECONNECT_DELAY_MS
        );

        reconnectAttempt += 1;

        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      intentionalClose = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      socket?.close();
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