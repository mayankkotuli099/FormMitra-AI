"use client";

import { MessageCircle } from "lucide-react";

import { useFormStore } from "@/store/useFormStore";

// Appears only after a PDF has actually been generated (downloadUrl is
// set) — sharing a form that doesn't exist yet would be a dead link.
// Note: on a real deployed domain this link works for anyone; while
// testing on localhost the link itself will only open on the same
// machine, since a phone on WhatsApp can't reach your computer's
// localhost — that's expected during local development, not a bug.
export default function ShareOnWhatsApp() {
  const downloadUrl = useFormStore((state) => state.downloadUrl);
  const formName = useFormStore((state) => state.formName);

  if (!downloadUrl) return null;

  const message = encodeURIComponent(
    `Maine "${formName || "yeh form"}" FormMitra AI se bhara hai. Yaha dekhiye: ${downloadUrl}`
  );

  return (
    <a
      href={`https://wa.me/?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-secondary w-full flex items-center justify-center gap-3"
    >
      <MessageCircle size={18} />
      Share on WhatsApp
    </a>
  );
}