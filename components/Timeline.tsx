"use client";

import { formatTime } from "@/lib/format-time";
import type { AdPerformance } from "@/lib/marker-config";
import { resolveAdForMarker } from "@/lib/marker-config";
import {
  MODE_COLORS,
  adDurationFor,
  buildTimeline,
  buildTimelineExcludingMarker,
  episodeMarkerToTimeline,
  episodeTimeFromPixelDelta,
  generateWaveformBars,
  getPlayheadLabels,
} from "@/lib/playback";
import type { Ad, AdMarker } from "@/lib/types";
import { Redo2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

const WAVEFORM = generateWaveformBars(200);
const MIN_PPS = 4;
const MAX_PPS = 48;
const TRACK_H = 112;
const RULER_H = 24;
const PLAYHEAD_HANDLE_W = 18;
const PLAYHEAD_HANDLE_H = 22;

type TimelineProps = {
  markers: AdMarker[];
  adsCatalog: Ad[];
  episodeDuration: number;
  episodeReady: boolean;
  performance: Record<string, AdPerformance>;
  timelineTime: number;
  selectedId: string | null;
  pixelsPerSecond: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (pps: number) => void;
  onSeek: (t: number) => void;
  onSelect: (id: string) => void;
  onMarkerMove: (id: string, startTime: number) => void;
};

type DragState = {
  id: string;
  pointerId: number;
  startX: number;
  initialEpisodeTime: number;
};

function TimelineMarker({
  marker,
  left,
  width,
  selected,
  onSelect,
  onPointerDown,
}: {
  marker: AdMarker;
  left: number;
  width: number;
  selected: boolean;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const colors = MODE_COLORS[marker.mode];

  return (
    <div
      data-marker
      role="button"
      tabIndex={0}
      style={{ left, width: Math.max(width, 36), zIndex: selected ? 25 : 20 }}
      className={`absolute top-0 flex h-full cursor-grab touch-none flex-col rounded-md border-2 ${colors.track} ${colors.border} select-none active:cursor-grabbing ${
        selected ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-900" : ""
      }`}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <span className={`m-1 truncate px-1 text-[10px] font-bold uppercase ${colors.text}`}>
        {marker.mode === "ab" ? "A/B" : marker.mode}
      </span>
    </div>
  );
}

function Playhead({
  left,
  timeLabel,
  episodeReady,
  onScrubStart,
}: {
  left: number;
  timeLabel: string;
  episodeReady: boolean;
  onScrubStart: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      data-playhead
      className="pointer-events-none absolute z-50"
      style={{
        left,
        top: 0,
        bottom: 0,
        width: 0,
      }}
      aria-hidden={!episodeReady}
    >
      <div
        data-playhead-handle
        role="slider"
        aria-label="Playhead"
        aria-valuetext={timeLabel}
        tabIndex={episodeReady ? 0 : -1}
        className={`pointer-events-auto absolute left-0 flex -translate-x-1/2 touch-none flex-col items-center ${
          episodeReady ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-50"
        }`}
        style={{ top: 0, width: PLAYHEAD_HANDLE_W }}
        onPointerDown={onScrubStart}
      >
        <div
          className="flex w-full items-center justify-center rounded-md border-2 border-red-700 bg-red-500 shadow-md"
          style={{ height: PLAYHEAD_HANDLE_H }}
        >
          <div className="h-2.5 w-1 rounded-full bg-red-100" />
        </div>
        <span className="mt-0.5 whitespace-nowrap rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
          {timeLabel}
        </span>
      </div>

      <div
        className="pointer-events-none absolute left-0 w-[2px] -translate-x-1/2 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.85)]"
        style={{ top: RULER_H + 8, bottom: 0 }}
      />
    </div>
  );
}

export function Timeline({
  markers,
  adsCatalog,
  episodeDuration,
  episodeReady,
  performance,
  timelineTime,
  selectedId,
  pixelsPerSecond,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoom,
  onSeek,
  onSelect,
  onMarkerMove,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const scrubbingRef = useRef(false);
  const playheadScrubbingRef = useRef(false);
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    episodeTime: number;
  } | null>(null);

  const markersRef = useRef(markers);
  markersRef.current = markers;
  const ppsRef = useRef(pixelsPerSecond);
  ppsRef.current = pixelsPerSecond;
  const episodeDurationRef = useRef(episodeDuration);
  episodeDurationRef.current = episodeDuration;
  const performanceRef = useRef(performance);
  performanceRef.current = performance;
  const adsCatalogRef = useRef(adsCatalog);
  adsCatalogRef.current = adsCatalog;

  const { segments, totalDuration } = useMemo(
    () => buildTimeline(markers, episodeDuration, adsCatalog, performance),
    [markers, episodeDuration, adsCatalog, performance]
  );

  const displayMarkers = episodeReady
    ? markers.filter((m) => m.adIds && m.adIds.length > 0)
    : [];

  const playheadLabels = useMemo(
    () => getPlayheadLabels(timelineTime, episodeDuration, segments),
    [timelineTime, episodeDuration, segments]
  );

  const trackWidth = Math.max(totalDuration * pixelsPerSecond, 800);
  const playheadLeft = timelineTime * pixelsPerSecond;

  const markerLayouts = useMemo(() => {
    return displayMarkers.map((m) => {
      const epTime =
        dragPreview?.id === m.id ? dragPreview.episodeTime : m.startTime;
      const tl = episodeMarkerToTimeline(epTime, segments);
      const adId = resolveAdForMarker(m, { performance }) ?? m.adIds[0];
      const w = adDurationFor(adsCatalog, adId) * pixelsPerSecond;
      return { marker: m, left: tl * pixelsPerSecond, width: w };
    });
  }, [
    displayMarkers,
    pixelsPerSecond,
    adsCatalog,
    segments,
    dragPreview,
    performance,
  ]);

  /** X position on track content from clientX (works with horizontal scroll) */
  const clientXToTimelineX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(0, clientX - rect.left);
  }, []);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      if (totalDuration <= 0) return;
      const x = clientXToTimelineX(clientX);
      const t = Math.max(0, Math.min(x / pixelsPerSecond, totalDuration));
      onSeek(t);
    },
    [clientXToTimelineX, onSeek, pixelsPerSecond, totalDuration]
  );

  const onPlayheadPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (dragRef.current || !episodeReady || totalDuration <= 0) return;

      e.stopPropagation();
      e.preventDefault();

      const handle = e.currentTarget as HTMLElement;
      handle.setPointerCapture(e.pointerId);
      playheadScrubbingRef.current = true;
      seekFromClientX(e.clientX);

      const onMove = (ev: PointerEvent) => {
        if (!playheadScrubbingRef.current) return;
        seekFromClientX(ev.clientX);
      };

      const onUp = (ev: PointerEvent) => {
        playheadScrubbingRef.current = false;
        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch {
          /* ok */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [episodeReady, seekFromClientX, totalDuration]
  );

  const onTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (
        dragRef.current ||
        playheadScrubbingRef.current ||
        !episodeReady ||
        totalDuration <= 0
      ) {
        return;
      }
      if ((e.target as HTMLElement).closest("[data-marker]")) return;
      if ((e.target as HTMLElement).closest("[data-playhead]")) return;

      const x = clientXToTimelineX(e.clientX);
      const nearPlayhead =
        Math.abs(x - playheadLeft) <= PLAYHEAD_HANDLE_W / 2 + 6;
      if (nearPlayhead) return;

      scrubbingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      seekFromClientX(e.clientX);

      const onMove = (ev: PointerEvent) => {
        if (!scrubbingRef.current) return;
        seekFromClientX(ev.clientX);
      };

      const onUp = (ev: PointerEvent) => {
        scrubbingRef.current = false;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId);
        } catch {
          /* capture already released */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [clientXToTimelineX, episodeReady, playheadLeft, seekFromClientX, totalDuration]
  );

  const onMarkerPointerDown = useCallback(
    (e: React.PointerEvent, marker: AdMarker) => {
      e.stopPropagation();
      e.preventDefault();

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      dragRef.current = {
        id: marker.id,
        pointerId: e.pointerId,
        startX: e.clientX,
        initialEpisodeTime: marker.startTime,
      };
      onSelect(marker.id);

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== marker.id) return;

        const deltaPx = ev.clientX - drag.startX;
        const dur = episodeDurationRef.current || 0;
        const pps = ppsRef.current;
        const { segments: segsForDrag } = buildTimelineExcludingMarker(
          markersRef.current,
          drag.id,
          dur,
          adsCatalogRef.current,
          performanceRef.current
        );

        const newEpisodeTime = episodeTimeFromPixelDelta(
          drag.initialEpisodeTime,
          deltaPx,
          segsForDrag,
          dur,
          pps
        );
        const clamped = Math.max(0, Math.min(newEpisodeTime, dur));
        setDragPreview({ id: drag.id, episodeTime: clamped });
      };

      const endDrag = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== marker.id) return;

        dragRef.current = null;
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* ok */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);

        const deltaPx = ev.clientX - drag.startX;
        setDragPreview(null);

        if (Math.abs(deltaPx) < 3) return;

        const dur = episodeDurationRef.current || 0;
        const pps = ppsRef.current;
        const { segments: segsForDrag } = buildTimelineExcludingMarker(
          markersRef.current,
          drag.id,
          dur,
          adsCatalogRef.current,
          performanceRef.current
        );

        const newEpisodeTime = episodeTimeFromPixelDelta(
          drag.initialEpisodeTime,
          deltaPx,
          segsForDrag,
          dur,
          pps
        );
        const clamped = Math.max(0, Math.min(newEpisodeTime, dur));
        onMarkerMove(drag.id, clamped);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [onMarkerMove, onSelect]
  );

  const ticks = useMemo(() => {
    const interval = pixelsPerSecond >= 20 ? 10 : pixelsPerSecond >= 10 ? 30 : 60;
    const count = Math.ceil(totalDuration / interval);
    return Array.from({ length: count + 1 }, (_, i) => i * interval);
  }, [totalDuration, pixelsPerSecond]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
            className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-30 hover:bg-zinc-50"
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
            className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-30 hover:bg-zinc-50"
          >
            <Redo2 className="h-4 w-4" />
            Redo
          </button>
        </div>

        <div className="flex flex-1 items-center gap-3 px-4">
          <ZoomOut className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            type="range"
            min={MIN_PPS}
            max={MAX_PPS}
            value={pixelsPerSecond}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="flex-1"
            aria-label="Timeline zoom"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-zinc-400" />
        </div>

        <div className="text-right font-mono text-sm tabular-nums text-zinc-600">
          <div>
            Video: {formatTime(playheadLabels.episodeTime)}
            {episodeDuration > 0 ? ` / ${formatTime(episodeDuration)}` : " —"}
          </div>
          <div className="text-xs text-zinc-500">
            Timeline: {formatTime(timelineTime)}
            {totalDuration > 0 ? ` / ${formatTime(totalDuration)}` : ""}
          </div>
          {playheadLabels.inAd && (
            <div className="text-xs text-orange-600">Playing ad · {playheadLabels.adLabel}</div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto px-4 pb-4">
        <div
          style={{ width: trackWidth, minWidth: "100%" }}
          className="relative"
        >
          <div className="relative mb-2" style={{ height: RULER_H }}>
            {ticks.map((sec) => (
              <div
                key={sec}
                className="pointer-events-none absolute border-l border-zinc-200 pl-1 text-[10px] text-zinc-400"
                style={{ left: sec * pixelsPerSecond }}
              >
                {formatTime(sec)}
              </div>
            ))}
          </div>

          <div
            ref={trackRef}
            className="relative cursor-pointer overflow-hidden rounded-lg bg-zinc-900"
            style={{ height: TRACK_H, width: trackWidth }}
            onPointerDown={onTrackPointerDown}
          >
            <div className="pointer-events-none absolute inset-0 flex items-end gap-[2px] px-1 pb-1 opacity-40">
              {WAVEFORM.map((h, i) => (
                <div
                  key={i}
                  className="w-[3px] shrink-0 rounded-sm bg-white"
                  style={{ height: `${h * 80}%` }}
                />
              ))}
            </div>

            <div
              className="pointer-events-none absolute inset-y-0 bg-fuchsia-300/40"
              style={{ left: 0, width: trackWidth }}
            />

            {markerLayouts.map(({ marker, left, width }) => (
              <TimelineMarker
                key={marker.id}
                marker={marker}
                left={left}
                width={width}
                selected={marker.id === selectedId}
                onSelect={() => onSelect(marker.id)}
                onPointerDown={(e) => onMarkerPointerDown(e, marker)}
              />
            ))}
          </div>

          <Playhead
            left={playheadLeft}
            timeLabel={formatTime(playheadLabels.episodeTime)}
            episodeReady={episodeReady}
            onScrubStart={onPlayheadPointerDown}
          />
        </div>
      </div>
    </div>
  );
}
