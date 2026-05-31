"use client";

import type { AdPerformance } from "@/lib/marker-config";
import type { Ad, AdMarker } from "@/lib/types";
import { Plus, Shuffle } from "lucide-react";
import { MarkerRow, cycleMode } from "./MarkerRow";

type MarkerPanelProps = {
  adsCatalog: Ad[];
  markers: AdMarker[];
  selectedId: string | null;
  episodeReady: boolean;
  performance: Record<string, AdPerformance>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRandomMarker: () => void;
  onDelete: (id: string) => void;
  onModeChange: (id: string, mode: AdMarker["mode"]) => void;
  onPickAd: (id: string) => void;
};

export function MarkerPanel({
  adsCatalog,
  markers,
  selectedId,
  episodeReady,
  performance,
  onSelect,
  onAdd,
  onRandomMarker,
  onDelete,
  onModeChange,
  onPickAd,
}: MarkerPanelProps) {
  return (
    <div className="flex w-[412px] shrink-0 flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-sm font-medium text-zinc-500">1</h2>
        <p className="text-base font-semibold text-zinc-900">Ad markers</p>
        {!episodeReady && (
          <p className="mt-1 text-xs text-amber-600">
            Upload a main video and wait for it to load before adding markers.
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {markers.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-400">
            {episodeReady
              ? "No markers yet. Add one at the playhead."
              : "Markers will appear here after your video is ready."}
          </p>
        )}
        {markers.map((m) => (
          <MarkerRow
            key={m.id}
            adsCatalog={adsCatalog}
            marker={m}
            selected={m.id === selectedId}
            performance={performance}
            onSelect={() => onSelect(m.id)}
            onModeCycle={() => onModeChange(m.id, cycleMode(m.mode))}
            onPickAd={() => onPickAd(m.id)}
            onDelete={() => onDelete(m.id)}
          />
        ))}
      </div>

      <div className="flex gap-2 border-t border-zinc-100 p-4">
        <button
          type="button"
          onClick={onAdd}
          disabled={!episodeReady}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Add marker
        </button>
        <button
          type="button"
          onClick={onRandomMarker}
          disabled={!episodeReady}
          title="Random time and mode"
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
        >
          <Shuffle className="h-4 w-4" />
          Random
        </button>
      </div>
    </div>
  );
}
