"use client";

import { formatTimecode } from "@/lib/format-time";
import { MODE_COLORS } from "@/lib/timeline-visual";
import type { AdMarker, AdMode } from "@/lib/types";
import { Trash2 } from "lucide-react";

const MODE_LABELS: Record<AdMode, string> = {
  static: "Static",
  auto: "Auto",
  ab: "A/B",
};

type MarkerRowProps = {
  index: number;
  marker: AdMarker;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onViewAbResults?: () => void;
  onDelete: () => void;
  showAbResults?: boolean;
};

export function MarkerRow({
  index,
  marker,
  selected,
  onSelect,
  onEdit,
  onViewAbResults,
  onDelete,
  showAbResults,
}: MarkerRowProps) {
  const colors = MODE_COLORS[marker.mode];
  const isAb = marker.mode === "ab";

  return (
    <div
      className={`grid grid-cols-[18px_88px_1fr_auto_32px] items-center gap-2 rounded-lg px-1.5 py-1.5 transition ${
        selected ? "bg-[#f9fafb] ring-1 ring-[#e5e7eb]" : "hover:bg-[#fafafa]"
      }`}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      role="button"
      tabIndex={0}
    >
      <span className="text-center text-[13px] font-medium text-[#9ca3af]">{index}</span>

      <div className="rounded-sm border border-[#e5e7eb] bg-white px-2 py-1.5 text-center text-[13px] tabular-nums text-[#111827]">
        {formatTimecode(marker.startTime)}
      </div>

      <span
        className={`inline-flex w-fit rounded-sm px-2.5 py-1 text-[11px] font-semibold ${colors.badge} ${colors.text}`}
      >
        {MODE_LABELS[marker.mode]}
      </span>

      {isAb && showAbResults && onViewAbResults ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewAbResults();
          }}
          className="shrink-0 rounded-sm border border-[#e5e7eb] bg-white px-3 py-1 text-[11px] font-medium text-[#374151] transition hover:bg-[#f9fafb]"
        >
          Results
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="shrink-0 rounded-sm border border-[#e5e7eb] bg-white px-3 py-1 text-[11px] font-medium text-[#374151] transition hover:bg-[#f9fafb]"
        >
          Edit
        </button>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#fef2f2] text-[#dc2626] transition hover:bg-[#fee2e2]"
        aria-label="Delete marker"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export { cycleMode, adIdsForModeSwitch } from "@/lib/marker-utils";
