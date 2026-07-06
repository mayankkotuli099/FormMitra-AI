"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { FileWarning, Loader2 } from "lucide-react";

import { usePDFStore } from "@/store/usePDFStore";
import { useFormStore } from "@/store/useFormStore";
import OCROverlay from "@/components/OCROverlay";

// PDF.js Worker
pdfjs.GlobalWorkerOptions.workerSrc =
  `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewer() {
  const { pdfUrl } = usePDFStore();
  const fields = useFormStore((state) => state.fields);

  const containerRef = useRef<HTMLDivElement>(null);

  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(760);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.max(entry.contentRect.width - 4, 280));
      }
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLoadError(false);
  }, [pdfUrl]);

  if (!pdfUrl) {
    return (
      <div className="surface w-full h-[500px] flex flex-col items-center justify-center gap-3 text-muted">
        <FileWarning size={40} className="opacity-40" />
        <p>No form uploaded yet</p>
      </div>
    );
  }

  const defaultPageWidth = 595;

  // Every page is rendered at the same `containerWidth`, but different
  // pages of the source PDF can have different original widths. Using a
  // single global reference width for every page meant coordinates on
  // any page other than the one that happened to supply the reference
  // were scaled incorrectly. Compute each page's own scale from the
  // fields whose coordinates actually belong to that page instead.
  const pageWidthByIndex = new Map<number, number>();

  for (const field of fields) {
    const coords = field.coordinates;
    if (coords?.page_width && !pageWidthByIndex.has(coords.page)) {
      pageWidthByIndex.set(coords.page, coords.page_width);
    }
  }

  const getScaleForPage = (pageIndex: number) =>
    containerWidth / (pageWidthByIndex.get(pageIndex) || defaultPageWidth);

  return (
    <div className="surface w-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <p className="font-medium text-sm text-muted">Live Form Preview</p>
        <p className="text-xs text-muted">Values appear here as you speak</p>
      </div>

      <div
        ref={containerRef}
        className="w-full max-h-[900px] overflow-y-auto bg-[#0d0d0d] px-2 py-4 space-y-4"
      >
        {loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted">
            <FileWarning size={36} className="opacity-40" />
            <p>Couldn't render a preview of this PDF.</p>
          </div>
        ) : (
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => setLoadError(true)}
            loading={
              <div className="flex items-center justify-center gap-2 py-24 text-muted">
                <Loader2 className="animate-spin" size={20} />
                Loading document...
              </div>
            }
          >
            {Array.from({ length: numPages }).map((_, index) => (
              <div
                key={index}
                className="relative mx-auto shadow-soft rounded-xl overflow-hidden"
                style={{ width: containerWidth }}
              >
                <Page
                  pageNumber={index + 1}
                  width={containerWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
                <OCROverlay pageIndex={index} scale={getScaleForPage(index)} />
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}