"use client";

import { create } from "zustand";

interface PDFStore {
  pdfUrl: string;
  setPdfUrl: (url: string) => void;
}

export const usePDFStore = create<PDFStore>((set) => ({
  pdfUrl: "",
  setPdfUrl: (url) => set({ pdfUrl: url }),
}));