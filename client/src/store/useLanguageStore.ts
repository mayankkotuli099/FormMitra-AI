"use client";

import { create } from "zustand";

interface LanguageStore {
  language: string;
  setLanguage: (language: string) => void;
}

export const useLanguageStore = create<LanguageStore>((set) => ({
  language: "en-IN",

  setLanguage: (language) =>
    set({
      language,
    }),
}));