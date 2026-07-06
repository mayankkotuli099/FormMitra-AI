"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useFormStore } from "@/store/useFormStore";

export default function ProgressSidebar() {
  const fields = useFormStore((state) => state.fields);
  const progress = useFormStore((state) => state.progress);
  const completed = useFormStore((state) => state.completed);

  const filledCount = fields.filter(
    (f) => f.value && f.value.trim() !== ""
  ).length;

  return (
    <div className="surface p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold">Progress</h2>
        {completed && (
          <span className="text-xs bg-white text-black rounded-full px-3 py-1 font-medium">
            Complete
          </span>
        )}
      </div>

      <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
        <div
          className="bg-white h-2 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-muted">
        {filledCount} / {fields.length || 0} fields · {progress}%
      </p>

      <div className="mt-6 space-y-3 max-h-[320px] overflow-y-auto pr-1">
        {fields.map((field) => {
          const done = field.value && field.value.trim() !== "";

          return (
            <div
              key={field.name}
              className="flex justify-between items-center text-sm"
            >
              <span className="text-muted truncate pr-3">
                {field.label || field.name}
                {field.required && (
                  <span className="text-white/60"> *</span>
                )}
              </span>

              {done ? (
                <CheckCircle2 size={16} className="text-white shrink-0" />
              ) : (
                <Circle size={16} className="text-muted/40 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}