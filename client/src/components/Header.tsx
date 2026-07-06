"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, ArrowLeft, Award, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

import { api } from "@/lib/api";
import { useFormStore } from "@/store/useFormStore";
import { usePDFStore } from "@/store/usePDFStore";

const SESSION_STORAGE_KEY = "formmitra_session_id";

export default function Header() {
  const formName = useFormStore((state) => state.formName);
  const uploaded = useFormStore((state) => state.uploaded);
  const reset = useFormStore((state) => state.reset);
  const setSessionId = useFormStore((state) => state.setSessionId);

  const setPdfUrl = usePDFStore((state) => state.setPdfUrl);

  const pathname = usePathname();
  const onCredits = pathname === "/credits";

  const handleStartNew = async () => {
    try {
      const res = await api.post("/session");

      reset();
      setPdfUrl("");
      setSessionId(res.data.session_id);

      window.localStorage.setItem(SESSION_STORAGE_KEY, res.data.session_id);

      toast.success("Started a new form");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't start a new form. Please try again.");
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-bg/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
            <Sparkles className="text-black" size={18} />
          </div>
          <h1 className="font-semibold text-lg tracking-tight">
            FormMitra AI
          </h1>
        </Link>

        {formName && !onCredits && (
          <span className="hidden sm:inline-flex items-center gap-2 text-xs text-muted border border-border rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulseSoft" />
            {formName}
          </span>
        )}

        <div className="flex items-center gap-3 shrink-0">
          {uploaded && !onCredits && (
            <button
              onClick={handleStartNew}
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Start New Form</span>
            </button>
          )}

          {onCredits ? (
            <Link href="/" className="btn-secondary text-sm py-2 px-4 flex items-center gap-2">
              <ArrowLeft size={16} />
              Back to App
            </Link>
          ) : (
            <Link href="/credits" className="btn-secondary text-sm py-2 px-4 flex items-center gap-2">
              <Award size={16} />
              Credits
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
