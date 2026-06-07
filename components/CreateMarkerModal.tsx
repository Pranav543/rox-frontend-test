"use client";

import type { AdMode } from "@/lib/types";
import { CircleDashed, FlaskConical, Target, X } from "lucide-react";
import { useState } from "react";

const OPTIONS: {
  mode: AdMode;
  title: string;
  description: string;
  icon: typeof CircleDashed;
}[] = [
  {
    mode: "auto",
    title: "Auto",
    description: "Automatic ad insertions",
    icon: CircleDashed,
  },
  {
    mode: "static",
    title: "Static",
    description: "A marker for a specific ad that you select",
    icon: Target,
  },
  {
    mode: "ab",
    title: "A/B test",
    description: "Compare the performance of multiple ads",
    icon: FlaskConical,
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: AdMode) => void;
};

export function CreateMarkerModal({ open, onClose, onSelect }: Props) {
  const [picked, setPicked] = useState<AdMode>("ab");

  if (!open) return null;

  return (
    <div
      data-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-6 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#f3f4f6] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Create ad marker</h2>
            <p className="mt-1 text-sm text-[#6b7280]">
              Insert a new ad marker into this episode
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#9ca3af] hover:bg-[#f3f4f6]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="space-y-2 p-4">
          {OPTIONS.map(({ mode, title, description, icon: Icon }) => {
            const active = picked === mode;
            return (
              <li key={mode}>
                <button
                  type="button"
                  onClick={() => setPicked(mode)}
                  className={`flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition ${
                    active
                      ? "border-[#111827] bg-[#fafafa] shadow-sm"
                      : "border-[#e5e7eb] bg-white hover:border-[#d1d5db]"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e5e7eb] bg-white">
                    <Icon className="h-5 w-5 text-[#6b7280]" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111827]">{title}</p>
                    <p className="text-xs text-[#6b7280]">{description}</p>
                  </div>
                  <span
                    className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                      active
                        ? "border-[#111827] bg-[#111827] ring-2 ring-white ring-inset"
                        : "border-[#d1d5db]"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end gap-2 border-t border-[#f3f4f6] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSelect(picked)}
            className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white hover:bg-[#1f2937]"
          >
            Select marker
          </button>
        </div>
      </div>
    </div>
  );
}
