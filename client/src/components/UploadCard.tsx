"use client";

import { UploadCloud, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import useUpload from "@/hooks/useUpload";
import { useFormStore } from "@/store/useFormStore";

export default function UploadCard() {
  const { upload } = useUpload();
  const loading = useFormStore((state) => state.loading);
  const uploaded = useFormStore((state) => state.uploaded);
  const formName = useFormStore((state) => state.formName);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    console.log("Selected File:", file.name);

    upload(file);
  };

  return (
    <div className="w-full">
      <input
        id="pdf-upload"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
        className="hidden"
        onChange={handleFile}
        disabled={loading}
      />

      <motion.label
        htmlFor="pdf-upload"
        whileHover={{ scale: loading ? 1 : 1.01 }}
        whileTap={{ scale: loading ? 1 : 0.99 }}
        className={`surface flex flex-col items-center justify-center gap-4 py-16 px-8 cursor-pointer transition-colors ${
          loading ? "opacity-60 cursor-wait" : "hover:border-white/30"
        }`}
      >
        {loading ? (
          <>
            <Loader2 size={44} className="animate-spin text-white" />
            <div className="text-center">
              <h2 className="text-xl font-semibold">
                Reading your form...
              </h2>
              <p className="mt-2 text-muted text-sm">
                Detecting fields, labels and existing values
              </p>
            </div>
          </>
        ) : (
          <>
            <UploadCloud size={44} className="text-white/80" />
            <div className="text-center">
              <h2 className="text-xl font-semibold">
                {uploaded ? "Upload a different form" : "Upload Government Form"}
              </h2>
              <p className="mt-2 text-muted text-sm">
                PAN · Aadhaar · Passport · Driving License · Bank · ITR
              </p>
            </div>
          </>
        )}

        {uploaded && formName && !loading && (
          <span className="text-xs text-muted border border-border rounded-full px-3 py-1">
            Detected: {formName}
          </span>
        )}
      </motion.label>
    </div>
  );
}