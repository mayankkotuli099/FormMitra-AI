"use client";

import { useFormStore, FormField } from "@/store/useFormStore";

/**
 * Feature 3 — Live PDF Filling.
 *
 * Renders one absolutely-positioned label over the PDF page for every
 * field that has coordinates AND a value. Because it reads straight
 * from useFormStore, any websocket update (the user speaking an
 * answer) re-renders this instantly — the value "appears" on the PDF
 * in real time, no page reload.
 *
 * Styled to look like blue-pen handwriting (same idea as the final
 * generated PDF) so the live preview matches what the download will
 * actually look like, instead of plain black computer text.
 *
 * `scale` converts the coordinate system OCR detected (PDF points,
 * see services/ocr_service.py -> attach_coordinates) into on-screen
 * pixels for the specific page currently being displayed.
 */

interface Props {
  pageIndex: number;
  scale: number;
}

export default function OCROverlay({ pageIndex, scale }: Props) {
  const fields = useFormStore((state) => state.fields);

  const visible = fields.filter(
    (f: FormField) =>
      f.coordinates &&
      f.coordinates.page === pageIndex &&
      f.value &&
      f.value.trim() !== ""
  );

  if (visible.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {visible.map((field, i) => {
        const c = field.coordinates!;

        // Small deterministic per-field jitter (based on field index)
        // so it reads as handwritten rather than machine-perfect, but
        // stays stable across re-renders instead of jittering on
        // every keystroke.
        const tilt = ((i % 5) - 2) * 0.6; // -1.2deg .. 1.2deg

        return (
          <span
            key={field.name}
            className="absolute animate-[fadeIn_0.4s_ease]"
            style={{
              left: c.x * scale,
              top: c.y * scale,
              width: c.width * scale,
              height: c.height * scale,
              fontSize: Math.max(c.font_size * scale * 1.25, 11),
              lineHeight: `${c.height * scale}px`,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontFamily: "var(--font-handwriting), cursive",
              color: "#1E4FD1",
              transform: `rotate(${tilt}deg)`,
              transformOrigin: "left center",
            }}
            title={field.label}
          >
            {field.value}
          </span>
        );
      })}
    </div>
  );
}