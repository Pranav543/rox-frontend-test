"use client";

import type { AdMarker } from "@/lib/types";
import { Plus, Sparkles } from "lucide-react";
import { ExportButton } from "./ExportButton";
import { MarkerRow } from "./MarkerRow";

type MarkerPanelProps = {
  markers: AdMarker[];
  selectedId: string | null;
  episodeReady: boolean;
  onSelect: (id: string) => void;
  onCreateMarker: () => void;
  onAutoPlace: () => void;
  onEdit: (id: string) => void;
  onViewAbResults: (id: string) => void;
  onDelete: (id: string) => void;
};

export function MarkerPanel({
  markers,
  selectedId,
  episodeReady,
  onSelect,
  onCreateMarker,
  onAutoPlace,
  onEdit,
  onViewAbResults,
  onDelete,
}: MarkerPanelProps) {
  const canExport =
    episodeReady && markers.some((m) => (m.adIds?.length ?? 0) > 0);

  return (
    <div className="flex h-full min-h-0 w-[360px] shrink-0 flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex shrink-0 items-center justify-between px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-[#111827]">Ad markers</h2>
        <span className="text-[11px] text-[#9ca3af]">
          {markers.length} marker{markers.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-2">
        {markers.length === 0 && (
          <p className="py-10 text-center text-sm text-[#9ca3af]">
            {episodeReady
              ? "No markers yet. Create one at the playhead."
              : "Load a video to add markers."}
          </p>
        )}
        {markers.map((m, i) => (
          <MarkerRow
            key={m.id}
            index={i + 1}
            marker={m}
            selected={m.id === selectedId}
            onSelect={() => onSelect(m.id)}
            onEdit={() => onEdit(m.id)}
            onViewAbResults={() => onViewAbResults(m.id)}
            showAbResults={m.mode === "ab" && (m.adIds?.length ?? 0) >= 2}
            onDelete={() => onDelete(m.id)}
          />
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 border-t border-[#f3f4f6] p-2.5">
        <button
          type="button"
          onClick={onCreateMarker}
          disabled={!episodeReady}
          className="flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-[#111827] text-[13px] font-medium text-white transition hover:bg-[#1f2937] disabled:opacity-40"
        >
          Create ad marker
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onAutoPlace}
          disabled={!episodeReady}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#e5e7eb] bg-white text-[13px] font-medium text-[#374151] transition hover:bg-[#f9fafb] disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#9ca3af]" />
          Automatically find ad breaks
        </button>
        <ExportButton
          disabled={!canExport}
          disabledReason={
            !episodeReady
              ? "Load the main video first"
              : !markers.some((m) => (m.adIds?.length ?? 0) > 0)
                ? "Assign ads to at least one marker"
                : undefined
          }
        />
      </div>
    </div>
  );
}
