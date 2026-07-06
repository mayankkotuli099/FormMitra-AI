"use client";

import { Download, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

import { api } from "@/lib/api";
import { useFormStore } from "@/store/useFormStore";

export default function DownloadButton() {
  const {
    sessionId,
    fields,
    uploaded,
    generating,
    downloadUrl,
    setGenerating,
    setDownloadUrl,
  } = useFormStore();

  const hasAnyValue = fields.some((f) => f.value && f.value.trim() !== "");

  const handleGenerate = async () => {
    if (!sessionId) return;

    setGenerating(true);

    try {
      const res = await api.post(`/generate/${sessionId}`);

      if (!res.data.success) {
        toast.error(res.data.message || "Could not generate the PDF.");
        return;
      }

      const fullUrl = `${process.env.NEXT_PUBLIC_API?.replace(
        "/api",
        ""
      )}${res.data.download_url}`;

      setDownloadUrl(fullUrl);

      const link = document.createElement("a");
      link.href = fullUrl;
      link.download = "filled-form.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Filled PDF generated.");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while generating the PDF.");
    } finally {
      setGenerating(false);
    }
  };

  if (!uploaded) return null;

  return (
    <button
      onClick={handleGenerate}
      disabled={generating || !hasAnyValue}
      className="btn-primary w-full flex items-center justify-center gap-3"
    >
      {generating ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          Generating...
        </>
      ) : downloadUrl ? (
        <>
          <CheckCircle2 size={18} />
          Download Again
        </>
      ) : (
        <>
          <Download size={18} />
          Generate & Download Filled PDF
        </>
      )}
    </button>
  );
}