"use client";

import { useEffect, useState } from "react";

import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";

import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

import { useConversationStore } from "@/store/useConversationStore";
import { useLanguageStore } from "@/store/useLanguageStore";

const BAR_COUNT = 5;

export default function VoiceOrb() {
  const [mounted, setMounted] = useState(false);

  const language = useLanguageStore((state) => state.language);

  const sendTranscript = useConversationStore(
    (state) => state.sendTranscript
  );

  const thinking = useConversationStore((state) => state.thinking);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!listening && transcript.trim() !== "") {
      console.log("🎤", transcript);

      if (sendTranscript) {
        useConversationStore.getState().addUserMessage(transcript);
        useConversationStore.getState().setThinking(true);

        sendTranscript(transcript, language);
      }

      resetTranscript();
    }
  }, [mounted, listening, transcript, language, sendTranscript, resetTranscript]);

  if (!mounted) return null;

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="surface p-6 text-center text-muted text-sm">
        Your browser doesn't support voice input. You can still type
        your answers below.
      </div>
    );
  }

  const toggleMic = async () => {
    if (listening) {
      SpeechRecognition.stopListening();
      return;
    }

    resetTranscript();
    await SpeechRecognition.startListening({
      continuous: false,
      language,
    });
  };

  return (
    <div className="surface flex flex-col items-center justify-center py-14 px-8">
      <motion.button
        onClick={toggleMic}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        animate={{
          boxShadow: listening
            ? [
                "0 0 0 0 rgba(255,255,255,0.25)",
                "0 0 0 24px rgba(255,255,255,0)",
              ]
            : "0 0 0 0 rgba(255,255,255,0)",
        }}
        transition={{
          repeat: listening ? Infinity : 0,
          duration: 1.6,
        }}
        className={`relative w-40 h-40 rounded-full flex items-center justify-center border transition-colors ${
          listening
            ? "bg-white text-black border-white"
            : "bg-white/5 text-white border-border hover:border-white/40"
        }`}
      >
        {listening ? <MicOff size={48} /> : <Mic size={48} />}
      </motion.button>

      {listening && (
        <div className="flex items-end gap-1.5 h-8 mt-8">
          {Array.from({ length: BAR_COUNT }).map((_, i) => (
            <motion.span
              key={i}
              className="w-1.5 bg-white rounded-full"
              animate={{ height: ["30%", "100%", "40%", "80%", "30%"] }}
              transition={{
                repeat: Infinity,
                duration: 0.9,
                delay: i * 0.1,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      <h2 className="mt-6 text-xl font-semibold">
        {listening ? "Listening..." : thinking ? "Thinking..." : "Tap to Speak"}
      </h2>

      <p className="mt-2 text-muted text-center text-sm max-w-sm">
        {transcript || "Speak naturally, in any supported language"}
      </p>
    </div>
  );
}