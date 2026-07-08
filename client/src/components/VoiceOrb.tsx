"use client";

import { useEffect, useRef, useState } from "react";

import { motion } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

import { api } from "@/lib/api";
import { WavRecorder } from "@/lib/wavRecorder";
import { useConversationStore } from "@/store/useConversationStore";
import { useLanguageStore } from "@/store/useLanguageStore";

const BAR_COUNT = 5;

// Only Hindi and English use the browser's own (free, unlimited)
// speech recognition — it's reliably supported for these two. Every
// other language records audio here and sends it to the backend,
// which transcribes it via Sarvam AI (see stt_service.py) — since
// browser-native support for most Indian regional languages is
// inconsistent across devices and OSes. This split also means the
// (limited-credit) Sarvam key is only ever spent on languages that
// actually need it.
const BROWSER_STT_LANGUAGES = new Set(["en-IN", "hi-IN"]);

// react-speech-recognition doesn't expose recognition errors through
// its hook — this reaches into the underlying native SpeechRecognition
// instance directly so browser-STT failures actually reach the user
// instead of failing silently.
const ERROR_MESSAGES: Record<string, string> = {
  "language-not-supported":
    "Your browser doesn't support voice input in this language. Try English or Hindi, or type your answer instead.",
  "no-speech": "Didn't catch that — please try speaking again.",
  "audio-capture": "Couldn't access your microphone. Check your mic permissions.",
  "not-allowed": "Microphone access was blocked. Please allow it in your browser settings.",
  network: "Voice recognition needs an internet connection. Please check your connection.",
};

const GENERIC_VOICE_ERROR =
  "Voice recognition hit a problem. Please try again or type your answer.";

export default function VoiceOrb() {
  const [mounted, setMounted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  const recorderRef = useRef<WavRecorder | null>(null);

  const language = useLanguageStore((state) => state.language);
  const useBrowserSTT = BROWSER_STT_LANGUAGES.has(language);

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

  // Stop any in-progress recording/mic stream if this component
  // unmounts mid-recording (e.g. navigating away) so the mic indicator
  // doesn't stay lit in the browser tab.
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        try {
          recorderRef.current.stop();
        } catch {
          // Already stopped/never started — nothing to clean up.
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!mounted || !useBrowserSTT) return;

    const recognition = SpeechRecognition.getRecognition();
    if (!recognition) return;

    const handleError = (event: { error: string }) => {
      console.warn("Speech recognition error:", event.error);
      toast.error(ERROR_MESSAGES[event.error] || GENERIC_VOICE_ERROR);
    };

    recognition.addEventListener("error", handleError);

    return () => {
      recognition.removeEventListener("error", handleError);
    };
  }, [mounted, useBrowserSTT]);

  useEffect(() => {
    if (!mounted || !useBrowserSTT) return;

    if (!listening && transcript.trim() !== "") {
      console.log("🎤", transcript);

      if (sendTranscript) {
        useConversationStore.getState().addUserMessage(transcript);
        useConversationStore.getState().setThinking(true);

        sendTranscript(transcript, language);
      }

      resetTranscript();
    }
  }, [
    mounted,
    useBrowserSTT,
    listening,
    transcript,
    language,
    sendTranscript,
    resetTranscript,
  ]);

  if (!mounted) return null;

  const startRecording = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error(
        "Voice input isn't supported in this browser. Please type your answer instead."
      );
      return;
    }

    try {
      const recorder = new WavRecorder();
      await recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error(err);
      toast.error(
        "Couldn't access your microphone. Check your mic permissions."
      );
    }
  };

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    setRecording(false);

    const blob = recorder.stop();
    recorderRef.current = null;

    // A near-empty recording means the mic was tapped and immediately
    // stopped — nothing worth sending. (44 bytes is just the WAV
    // header with zero audio samples.)
    if (blob.size <= 44) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", blob, "recording.wav");
      formData.append("language", language);

      const res = await api.post("/stt", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        const text = res.data.transcript as string;
        console.log("🎤", text);

        if (sendTranscript) {
          useConversationStore.getState().addUserMessage(text);
          useConversationStore.getState().setThinking(true);
          sendTranscript(text, language);
        }
      } else {
        toast.error(res.data.message || GENERIC_VOICE_ERROR);
      }
    } catch (err) {
      console.error(err);
      toast.error(GENERIC_VOICE_ERROR);
    } finally {
      setUploading(false);
    }
  };

  const toggleMic = async () => {
    if (useBrowserSTT) {
      if (listening) {
        SpeechRecognition.stopListening();
        return;
      }

      resetTranscript();
      await SpeechRecognition.startListening({
        continuous: false,
        language,
      });
      return;
    }

    if (recording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  if (useBrowserSTT && !browserSupportsSpeechRecognition) {
    return (
      <div className="surface p-6 text-center text-muted text-sm">
        Your browser doesn't support voice input. You can still type
        your answers below.
      </div>
    );
  }

  const isActive = useBrowserSTT ? listening : recording;

  return (
    <div className="surface flex flex-col items-center justify-center py-14 px-8">
      <motion.button
        onClick={toggleMic}
        disabled={uploading}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        animate={{
          boxShadow: isActive
            ? [
                "0 0 0 0 rgba(255,255,255,0.25)",
                "0 0 0 24px rgba(255,255,255,0)",
              ]
            : "0 0 0 0 rgba(255,255,255,0)",
        }}
        transition={{
          repeat: isActive ? Infinity : 0,
          duration: 1.6,
        }}
        className={`relative w-40 h-40 rounded-full flex items-center justify-center border transition-colors disabled:opacity-60 ${
          isActive
            ? "bg-white text-black border-white"
            : "bg-white/5 text-white border-border hover:border-white/40"
        }`}
      >
        {uploading ? (
          <Loader2 size={48} className="animate-spin" />
        ) : isActive ? (
          <MicOff size={48} />
        ) : (
          <Mic size={48} />
        )}
      </motion.button>

      {isActive && (
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
        {uploading
          ? "Processing..."
          : isActive
          ? "Listening..."
          : thinking
          ? "Thinking..."
          : "Tap to Speak"}
      </h2>

      <p className="mt-2 text-muted text-center text-sm max-w-sm">
        {useBrowserSTT
          ? transcript || "Speak naturally, in any supported language"
          : "Tap to start, speak naturally, then tap again to stop"}
      </p>
    </div>
  );
}