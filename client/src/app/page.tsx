"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

import { api } from "@/lib/api";

import Header from "@/components/Header";
import Hero from "@/components/Hero";
import UploadCard from "@/components/UploadCard";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import VoiceOrb from "@/components/VoiceOrb";
import LanguageSelector from "@/components/LanguageSelector";
import ConversationPanel from "@/components/ConversationPanel";
import TranscriptInput from "@/components/TranscriptInput";
import ProgressSidebar from "@/components/ProgressSidebar";
import LiveFormViewer from "@/components/LiveFormViewer";
import DownloadButton from "@/components/DownloadButton";

import useConversation from "@/hooks/useConversation";

import { useFormStore } from "@/store/useFormStore";

const SESSION_STORAGE_KEY = "formmitra_session_id";

// react-pdf (and the pdfjs-dist it bundles) touches browser-only APIs
// (DOMMatrix, Path2D, etc.) as soon as its module loads. Next.js
// server-renders "use client" components by default, which crashes on
// the server before the code ever reaches the browser. ssr:false keeps
// this component out of the server render entirely.
const PDFViewer = dynamic(() => import("@/components/PDFViewer"), {
  ssr: false,
  loading: () => (
    <div className="surface w-full h-[500px] flex items-center justify-center gap-2 text-muted">
      <Loader2 className="animate-spin" size={20} />
      Loading PDF viewer...
    </div>
  ),
});

export default function Home() {
  useConversation();

  const { setSessionId } = useFormStore();

  // Every page load starts a brand new session — no auto-resume of a
  // previously uploaded form. (Users can still pick up mid-conversation
  // if they haven't reloaded; "Start New Form" in the header lets them
  // reset deliberately at any point without needing to reload at all.)
  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.post("/session");
        setSessionId(res.data.session_id);

        window.localStorage.setItem(
          SESSION_STORAGE_KEY,
          res.data.session_id
        );
      } catch (err) {
        console.error(err);
        toast.error(
          "Couldn't connect to FormMitra AI. Please refresh the page."
        );
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen">
      <Header />
      <Hero />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 px-6 pb-24">
        <div className="lg:col-span-2 space-y-6">
          <UploadCard />
          <PDFViewer />
          <VoiceOrb />
          <LanguageSelector />
          <ConversationPanel />
          <TranscriptInput />
        </div>

        <div className="space-y-6">
          <ProgressSidebar />
          <LiveFormViewer />
          <DownloadButton />
        </div>
      </div>
    </main>
  );
}
