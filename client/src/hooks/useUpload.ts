"use client";

import { useRef } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { useFormStore } from "@/store/useFormStore";
import { usePDFStore } from "@/store/usePDFStore";
import { useConversationStore } from "@/store/useConversationStore";
import speak from "@/hooks/useSpeak";

// Feature — debounce: ignore a re-upload of the exact same file (same
// name/size/last-modified) if it lands within this window of the
// previous one. Guards against double-clicks / duplicate change events
// firing an extra OCR request for content the backend already has.
const DUPLICATE_UPLOAD_WINDOW_MS = 4000;

export default function useUpload() {
  const {
    sessionId,
    setFields,
    setLoading,
    setUploaded,
    setFormName,
    setDownloadUrl,
  } = useFormStore();

  const { setPdfUrl } = usePDFStore();
  const addAIMessage = useConversationStore((state) => state.addAIMessage);

  const lastUpload = useRef<{ signature: string; at: number } | null>(null);

  const upload = async (file: File) => {
    if (!sessionId) {
      toast.error("Session not ready. Please wait a second.");
      return;
    }

    const signature = `${file.name}:${file.size}:${file.lastModified}`;
    const now = Date.now();

    if (
      lastUpload.current &&
      lastUpload.current.signature === signature &&
      now - lastUpload.current.at < DUPLICATE_UPLOAD_WINDOW_MS
    ) {
      console.log("Duplicate upload ignored (debounced):", signature);
      return;
    }

    lastUpload.current = { signature, at: now };

    const form = new FormData();

    form.append("file", file);
    form.append("session_id", sessionId);

    setLoading(true);
    setDownloadUrl("");

    try {
      console.log("Uploading...");
      console.log("Session =", sessionId);

      const res = await api.post(
        "/upload",
        form,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("UPLOAD RESPONSE");
      console.log(res.data);

      if (!res.data.success) {
        toast.error(res.data.message || "Upload failed.");
        return;
      }

      setFields(res.data.fields);
      setFormName(res.data.form_name || "Government Form");

      setPdfUrl(
        `${process.env.NEXT_PUBLIC_API?.replace("/api", "")}${res.data.pdf_url}`
      );

      setUploaded(true);

      // Feature — warn (not block) when this doesn't look like a typical
      // government form, e.g. a resume/CV was uploaded instead.
      if (res.data.is_recognized_form === false) {
        toast(
          "This doesn't look like a typical government form — extracted fields may be less accurate.",
          { icon: "⚠️", duration: 5000 }
        );
      } else {
        toast.success(`Detected: ${res.data.form_name || "Government Form"}`);
      }

      // Feature — proactively greet the user (chat + voice) instead of
      // making them speak first. Asks the first missing field right
      // away so the conversation starts moving immediately.
      if (res.data.opening_message) {
        addAIMessage(res.data.opening_message);
        speak(res.data.opening_message);
      }
} catch (err: any) {

  console.log("========== UPLOAD ERROR ==========");

  console.log(err);

  console.log(err.response);

  console.log(err.response?.data);

  console.log(err.message);

  console.log("==================================");

  toast.error("Upload failed. Please check the file and try again.");

} finally {

  setLoading(false);

}
  };

  return {
    upload,
  };
}