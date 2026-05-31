"use client";

import type { Ad, AdMode } from "@/lib/types";
import { X } from "lucide-react";

type AdPickerModalProps = {
  open: boolean;
  mode: AdMode;
  ads: Ad[];
  selectedIds: string[];
  onClose: () => void;
  onSave: (adIds: string[]) => void;
};

export function AdPickerModal({
  open,
  mode,
  ads,
  selectedIds,
  onClose,
  onSave,
}: AdPickerModalProps) {
  if (!open) return null;

  const isStatic = mode === "static";
  const title = isStatic
    ? "Choose ad (Static)"
    : mode === "auto"
      ? "Choose ads (Auto — random from selection)"
      : "Choose ads (A/B — best CTR from selection)";

  const toggle = (id: string) => {
    if (isStatic) {
      onSave([id]);
      onClose();
      return;
    }
    if (selectedIds.includes(id)) {
      onSave(selectedIds.filter((x) => x !== id));
    } else {
      onSave([...selectedIds, id]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div>
            <h3 className="font-semibold text-zinc-900">{title}</h3>
            <p className="text-xs text-zinc-500">Videos in data/ads/</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="max-h-64 overflow-y-auto p-2">
          {ads.map((ad) => (
            <li key={ad.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-zinc-50">
                <input
                  type={isStatic ? "radio" : "checkbox"}
                  name="ad-pick"
                  checked={selectedIds.includes(ad.id)}
                  onChange={() => toggle(ad.id)}
                />
                <span className="text-sm font-medium text-zinc-800">{ad.name}</span>
              </label>
            </li>
          ))}
        </ul>

        {!isStatic && (
          <div className="border-t border-zinc-100 p-3">
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length > 0) onClose();
              }}
              disabled={selectedIds.length === 0}
              className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
