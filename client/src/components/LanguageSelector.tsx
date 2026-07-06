"use client";

import { Languages } from "lucide-react";
import { useLanguageStore } from "@/store/useLanguageStore";

const languages = [
  { name: "English", code: "en-IN" },
  { name: "हिन्दी", code: "hi-IN" },
  { name: "বাংলা", code: "bn-IN" },
  { name: "ગુજરાતી", code: "gu-IN" },
  { name: "मराठी", code: "mr-IN" },
  { name: "தமிழ்", code: "ta-IN" },
  { name: "తెలుగు", code: "te-IN" },
  { name: "ಕನ್ನಡ", code: "kn-IN" },
  { name: "മലയാളം", code: "ml-IN" },
  { name: "ਪੰਜਾਬੀ", code: "pa-IN" },
  { name: "ଓଡ଼ିଆ", code: "or-IN" },
  { name: "অসমীয়া", code: "as-IN" },
];

export default function LanguageSelector() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2 mb-4 text-sm font-medium text-muted">
        <Languages size={16} />
        Conversation Language
      </div>

      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="w-full bg-[#0d0d0d] border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-white/40 transition-colors"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}