"use client";

import { useState } from "react";
import { Volume2, Loader2 } from "lucide-react";

import speak from "@/hooks/useSpeak";
import { useFormStore } from "@/store/useFormStore";

// Lets a low-literacy user hear their completed form read back before
// downloading it, instead of having to read every field themselves to
// check it's correct. Fits the app's voice-first pitch end-to-end:
// speak your answers in → hear the filled form read back before you
// commit to it.
export default function ReadBackButton() {
  const fields = useFormStore((state) => state.fields);
  const completed = useFormStore((state) => state.completed);
  const [speaking, setSpeaking] = useState(false);

  const filled = fields.filter((f) => f.value && f.value.trim() !== "");

  if (!completed || filled.length === 0) return null;

  const handleReadBack = () => {
    setSpeaking(true);

    // One combined utterance (rather than one speak() call per field)
    // so it plays as a single continuous readout — speak() cancels any
    // in-progress utterance before starting a new one, so calling it
    // per field would just cut off the previous field's audio.
    const summary = filled
      .map((f) => `${f.label || f.name}: ${f.value}`)
      .join(". ");

    speak(
      `Aapka form is tarah bhara gaya hai. ${summary}. Agar sab sahi hai, to neeche download button dabaaiye.`
    );

    // The Web Speech API doesn't give us a reliable "finished speaking"
    // callback wired up here, so re-enable the button after a rough
    // duration estimate rather than leaving it stuck on "Reading...".
    const estimatedMs = Math.min(20000, 1500 + summary.length * 60);
    setTimeout(() => setSpeaking(false), estimatedMs);
  };

  return (
    <button
      onClick={handleReadBack}
      disabled={speaking}
      className="btn-secondary w-full flex items-center justify-center gap-3"
    >
      {speaking ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          Reading your form back to you...
        </>
      ) : (
        <>
          <Volume2 size={18} />
          Sunkar Confirm Karo
        </>
      )}
    </button>
  );
}