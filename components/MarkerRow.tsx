"use client";

import type { AdPerformance } from "@/lib/marker-config";
import { resolveAdForMarker } from "@/lib/marker-config";
import { cycleMode } from "@/lib/marker-utils";
import { MODE_COLORS } from "@/lib/timeline-visual";
import type { Ad, AdMarker, AdMode } from "@/lib/types";
import { ChevronRight, Trash2 } from "lucide-react";

const MODE_LABELS: Record<AdMode, string> = {
  static: "Static",
  auto: "Auto",
  ab: "A/B",
};

type MarkerRowProps = {
  adsCatalog: Ad[];
  marker: AdMarker;
  selected: boolean;
  performance: Record<string, AdPerformance>;
  onSelect: () => void;
  onModeCycle: () => void;
  onPickAd: () => void;
  onDelete: () => void;
};

export function MarkerRow({
  adsCatalog,
  marker,
  selected,
  performance,
  onSelect,
  onModeCycle,
  onPickAd,
  onDelete,
}: MarkerRowProps) {
  const colors = MODE_COLORS[marker.mode];
  const resolvedId = resolveAdForMarker(marker, { performance });
  const adName = resolvedId
    ? (adsCatalog.find((a) => a.id === resolvedId)?.name ?? resolvedId)
    : "Choose ad…";

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-3 transition-all ${
        selected
          ? "border-zinc-400 bg-zinc-50 shadow-sm"
          : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onModeCycle();
        }}
        title="Change mode: Static → Auto → A/B"
        className={`shrink-0 rounded-md px-3 py-1 text-xs font-semibold ${colors.badge} ${colors.text}`}
      >
        {MODE_LABELS[marker.mode]}
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium text-zinc-800">
          @ {formatMarkerTime(marker.startTime)}
        </p>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPickAd();
        }}
        className="flex max-w-[120px] items-center gap-0.5 truncate rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-white"
      >
        <span className="truncate">{adName}</span>
        <ChevronRight className="h-3 w-3 shrink-0" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="rounded p-1.5 text-red-800/70 hover:bg-red-50"
        aria-label="Delete marker"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function formatMarkerTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export { cycleMode, adIdsForModeSwitch } from "@/lib/marker-utils";
