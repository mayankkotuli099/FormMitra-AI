"use client";

import { useLanguageStore } from "@/store/useLanguageStore";

export default function speak(text: string) {
  if (typeof window === "undefined") return;

  window.speechSynthesis.cancel();

  const language = useLanguageStore.getState().language;

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang = language;
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices();

  const selectedVoice =
    voices.find((v) => v.lang === language) ||
    voices.find((v) => v.lang.startsWith(language.split("-")[0])) ||
    voices.find((v) => v.lang.startsWith("en"));

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  console.log("🔊 Speaking in:", language);

  window.speechSynthesis.speak(utterance);
}