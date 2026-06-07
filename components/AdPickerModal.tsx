"use client";

import { mediaUrl } from "@/lib/ads";
import type { Ad, AdMode } from "@/lib/types";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Search,
  Waves,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

const FOLDERS = [
  { id: "all", label: "All folders", children: [] as string[] },
  {
    id: "eight",
    label: "Eight Sleep",
    children: ["Pod 3", "Q3 Promo", "Athlete Campaign"],
  },
  { id: "brilliant", label: "Brilliant", children: [] as string[] },
  { id: "milligram", label: "Milligram", children: [] as string[] },
];

type AdPickerModalProps = {
  open: boolean;
  mode: AdMode;
  ads: Ad[];
  selectedIds: string[];
  onClose: () => void;
  onSave: (adIds: string[]) => void;
};

function modalTitle(mode: AdMode): string {
  if (mode === "static") return "Select ad";
  if (mode === "auto") return "Select ads (Auto)";
  return "A/B test";
}

function modalSubtitle(mode: AdMode): string {
  if (mode === "static") return "Select which ad you'd like to use.";
  if (mode === "auto") return "Select ads to rotate randomly from.";
  return "Select which ads you'd like to A/B test.";
}

function primaryLabel(mode: AdMode, count: number): string {
  if (mode === "static") return "Select ad";
  if (mode === "ab") return "Create A/B test";
  return count > 0 ? "Done" : "Select ads";
}

export function AdPickerModal({
  open,
  mode,
  ads,
  selectedIds,
  onClose,
  onSave,
}: AdPickerModalProps) {
  const [query, setQuery] = useState("");
  const [folderOpen, setFolderOpen] = useState<Record<string, boolean>>({
    eight: true,
  });
  const [activeFolder, setActiveFolder] = useState("all");

  const isStatic = mode === "static";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ads;
    return ads.filter((a) => a.name.toLowerCase().includes(q));
  }, [ads, query]);

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

  if (!open) return null;

  return (
    <div
      data-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#f3f4f6] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">{modalTitle(mode)}</h2>
            <p className="mt-1 text-sm text-[#6b7280]">{modalSubtitle(mode)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-[#f3f4f6]">
            <X className="h-5 w-5 text-[#9ca3af]" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="w-56 shrink-0 border-r border-[#f3f4f6] p-4">
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                type="search"
                placeholder="Search library…"
                className="w-full rounded-lg border border-[#e5e7eb] bg-[#f9fafb] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#9ca3af]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#6b7280]">
              <Waves className="h-3.5 w-3.5" />
              Ad library
            </p>
            <ul className="space-y-0.5 text-sm">
              {FOLDERS.map((f) => (
                <li key={f.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveFolder(f.id)}
                    onKeyDown={(e) => e.key === "Enter" && setActiveFolder(f.id)}
                    className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left ${
                      activeFolder === f.id
                        ? "bg-[#f3f4f6] font-medium text-[#111827]"
                        : "text-[#6b7280] hover:bg-[#f9fafb]"
                    }`}
                  >
                    {f.children.length > 0 ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="p-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderOpen((o) => ({ ...o, [f.id]: !o[f.id] }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            setFolderOpen((o) => ({ ...o, [f.id]: !o[f.id] }));
                          }
                        }}
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition ${folderOpen[f.id] ? "" : "-rotate-90"}`}
                        />
                      </span>
                    ) : (
                      <Folder className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {f.label}
                  </div>
                  {f.children.length > 0 && folderOpen[f.id] && (
                    <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-[#e5e7eb] pl-2">
                      {f.children.map((c) => (
                        <li key={c}>
                          <button
                            type="button"
                            className="w-full rounded px-2 py-1 text-left text-xs text-[#6b7280] hover:bg-[#f9fafb]"
                          >
                            {c}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-[#f3f4f6] px-4 py-3">
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-xs text-[#6b7280]"
              >
                Upload date
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                <input
                  type="search"
                  placeholder="Search ads…"
                  className="w-full rounded-lg border border-[#e5e7eb] py-1.5 pl-9 pr-3 text-sm outline-none"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <ul className="flex-1 overflow-y-auto p-3">
              {filtered.map((ad) => {
                const checked = selectedIds.includes(ad.id);
                const mins = Math.floor(ad.duration / 60);
                const secs = ad.duration % 60;
                return (
                  <li key={ad.id}>
                    <label
                      className={`mb-2 flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                        checked ? "border-[#111827] bg-[#fafafa]" : "border-[#e5e7eb] hover:bg-[#f9fafb]"
                      }`}
                    >
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-[#ddd6fe] to-[#a78bfa]">
                        <video
                          className="h-full w-full object-cover opacity-80"
                          src={mediaUrl(ad.filename)}
                          muted
                          preload="metadata"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#111827]">
                          {ad.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#9ca3af]">
                          <span>13/03/24</span>
                          <span>·</span>
                          <span>
                            {mins}m {secs}s
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block h-4 w-4 rounded-full bg-gradient-to-br from-slate-300 to-slate-400" />
                            Denis Loginoff
                          </span>
                        </p>
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-[#6b7280]">
                          <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5">
                            {ad.name.split(" ")[0]}
                          </span>
                          <ChevronRight className="h-3 w-3" />
                          <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5">
                            Pod 3
                          </span>
                        </div>
                      </div>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                          checked
                            ? "border-[#111827] bg-[#111827] text-white"
                            : "border-[#d1d5db] bg-white"
                        }`}
                      >
                        {checked ? (
                          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M2 6l3 3 5-5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                      <input
                        type={isStatic ? "radio" : "checkbox"}
                        name="ad-pick"
                        checked={checked}
                        onChange={() => toggle(ad.id)}
                        className="sr-only"
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#f3f4f6] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
          >
            Cancel
          </button>
          <div className="flex items-center gap-4">
            {!isStatic && (
              <span className="text-sm text-[#6b7280]">
                {selectedIds.length} ad{selectedIds.length === 1 ? "" : "s"} selected
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length > 0 || isStatic) onClose();
              }}
              disabled={!isStatic && selectedIds.length === 0}
              className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white hover:bg-[#1f2937] disabled:opacity-40"
            >
              {primaryLabel(mode, selectedIds.length)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
