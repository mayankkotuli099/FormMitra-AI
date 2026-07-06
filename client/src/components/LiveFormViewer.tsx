"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { useFormStore } from "@/store/useFormStore";

export default function LiveFormViewer() {
  const fields = useFormStore((state) => state.fields);

  if (fields.length === 0) {
    return (
      <div className="surface p-6 text-sm text-muted text-center">
        Extracted field values will show up here once you upload a form.
      </div>
    );
  }

  return (
    <div className="surface p-6">
      <h2 className="text-lg font-semibold mb-5">Extracted Fields</h2>

      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        {fields.map((field) => {
          const done = field.value && field.value.trim() !== "";

          return (
            <div
              key={field.name}
              className="border border-border rounded-2xl p-4 flex justify-between items-center gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs text-muted truncate">
                  {field.label || field.name}
                </p>

                <p className="font-medium text-sm mt-1 truncate">
                  {done ? field.value : "Awaiting..."}
                </p>
              </div>

              {done ? (
                <CheckCircle2 size={18} className="text-white shrink-0" />
              ) : (
                <Clock size={18} className="text-muted/50 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}