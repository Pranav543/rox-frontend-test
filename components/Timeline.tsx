"use client";

import { formatTimecode } from "@/lib/format-time";
import type { AdPerformance } from "@/lib/marker-config";
import { resolveAdForMarker } from "@/lib/marker-config";
import { adDurationFor, buildTimeline } from "@/lib/playback";
import {
  buildTimelineExcludingMarker,
  episodeMarkerToTimeline,
  episodeTimeFromPixelDelta,
  getPlayheadLabels,
} from "@/lib/timeline-mapping";
import { mediaUrl } from "@/lib/ads";
import { MODE_COLORS, generateWaveformBars } from "@/lib/timeline-visual";
import type { Ad, AdMarker } from "@/lib/types";
import { Redo2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const WAVEFORM = generateWaveformBars(200);
const MIN_PPS = 4;
const MAX_PPS = 48;
const TRACK_H = 88;
const RULER_H = 20;
const PLAYHEAD_HANDLE_W = 18;
const PLAYHEAD_HANDLE_H = 20;

type TimelineProps = {
  markers: AdMarker[];
  adsCatalog: Ad[];
  episodeDuration: number;
  episodeReady: boolean;
  playing: boolean;
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

function MarkerGrip() {
  return (
    <div className="flex h-3 w-4 flex-wrap items-center justify-center gap-[2px] px-0.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-[1px] bg-white/90" />
      ))}
    </div>
  );
}

function TimelineMarker({
  marker,
  left,
  width,
  selected,
  thumbnail,
  onSelect,
  onPointerDown,
}: {
  marker: AdMarker;
  left: number;
  width: number;
  selected: boolean;
  thumbnail?: string;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const colors = MODE_COLORS[marker.mode];
  const blockW = Math.max(width, 40);

  return (
    <div
      data-marker
      role="button"
      tabIndex={0}
      style={{ left, width: blockW, zIndex: selected ? 25 : 20 }}
      className={`absolute top-0 flex h-full cursor-grab touch-none flex-col justify-between rounded-md border-2 transition-[left,width] duration-200 ease-out ${colors.track} ${colors.border} select-none active:cursor-grabbing ${
        selected ? "ring-2 ring-white/80" : ""
      }`}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <span
        className={`m-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[9px] font-bold shadow-sm ${colors.text}`}
      >
        {colors.icon}
      </span>
      {thumbnail && marker.mode === "static" && blockW > 56 ? (
        <div className="mx-1 mb-5 overflow-hidden rounded border border-white/60 bg-black/20">
          <video
            className="h-8 w-full object-cover"
            src={thumbnail}
            muted
            preload="metadata"
          />
        </div>
      ) : (
        <span />
      )}
      <div className="flex justify-center pb-0.5">
        <MarkerGrip />
      </div>
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
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        tabIndex={episodeReady ? 0 : -1}
        className={`pointer-events-auto absolute left-0 flex -translate-x-1/2 touch-none flex-col items-center ${
          episodeReady ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-50"
        }`}
        style={{ top: 0, width: PLAYHEAD_HANDLE_W }}
        onPointerDown={onScrubStart}
      >
        <div
          className="flex w-full items-center justify-center rounded-[3px] border-2 border-[#b91c1c] bg-[#ef4444] shadow-md"
          style={{ height: PLAYHEAD_HANDLE_H }}
        >
          <div className="grid grid-cols-2 gap-[2px] p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="h-[3px] w-[3px] rounded-[1px] bg-white" />
            ))}
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute left-0 w-[2px] -translate-x-1/2 bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]"
        style={{ top: PLAYHEAD_HANDLE_H - 2, bottom: -RULER_H - 8 }}
      />
    </div>
  );
}

export function Timeline({
  markers,
  adsCatalog,
  episodeDuration,
  episodeReady,
  playing,
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

  const displayMarkers = useMemo(
    () =>
      episodeReady
        ? markers.filter((m) => m.adIds && m.adIds.length > 0)
        : [],
    [episodeReady, markers]
  );

  const playheadLabels = useMemo(
    () => getPlayheadLabels(timelineTime, episodeDuration, segments),
    [timelineTime, episodeDuration, segments]
  );

  const trackWidth = Math.max(totalDuration * pixelsPerSecond, 800);
  const playheadLeft = timelineTime * pixelsPerSecond;

  useEffect(() => {
    if (!playing || !scrollRef.current || totalDuration <= 0) return;
    const el = scrollRef.current;
    const margin = 80;
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    if (playheadLeft < viewLeft + margin || playheadLeft > viewRight - margin) {
      el.scrollTo({
        left: Math.max(0, playheadLeft - el.clientWidth / 3),
        behavior: "smooth",
      });
    }
  }, [playheadLeft, playing, totalDuration]);

  const markerLayouts = useMemo(() => {
    return displayMarkers.map((m) => {
      const epTime =
        dragPreview?.id === m.id ? dragPreview.episodeTime : m.startTime;
      const tl = episodeMarkerToTimeline(epTime, segments);
      const adId = resolveAdForMarker(m, { performance }) ?? m.adIds[0];
      const ad = adsCatalog.find((a) => a.id === adId);
      const w = adDurationFor(adsCatalog, adId) * pixelsPerSecond;
      return {
        marker: m,
        left: tl * pixelsPerSecond,
        width: w,
        thumbnail: ad ? mediaUrl(ad.filename) : undefined,
      };
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
    <div className="rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="relative flex items-center border-b border-[#f3f4f6] px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
            className="flex items-center gap-1.5 rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#374151] disabled:opacity-30 hover:bg-[#f9fafb]"
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
            className="flex items-center gap-1.5 rounded-full border border-[#e5e7eb] px-3 py-1.5 text-sm text-[#374151] disabled:opacity-30 hover:bg-[#f9fafb]"
          >
            <Redo2 className="h-4 w-4" />
            Redo
          </button>
        </div>

        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1 font-mono text-[13px] font-medium tabular-nums text-[#111827]">
          {formatTimecode(playheadLabels.episodeTime)}
        </div>

        <div className="ml-auto flex w-[200px] items-center gap-2">
          <ZoomOut className="h-4 w-4 shrink-0 text-[#9ca3af]" />
          <input
            type="range"
            min={MIN_PPS}
            max={MAX_PPS}
            value={pixelsPerSecond}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="flex-1"
            aria-label="Timeline zoom"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-[#9ca3af]" />
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto px-4 pb-2">
        <div
          style={{ width: trackWidth, minWidth: "100%" }}
          className="relative"
        >
          <div className="relative" style={{ height: TRACK_H + PLAYHEAD_HANDLE_H }}>
            <div
              ref={trackRef}
              className="absolute left-0 right-0 cursor-pointer overflow-hidden rounded-lg border border-[#e9d5ff] bg-[#f3e8ff]"
              style={{
                top: PLAYHEAD_HANDLE_H - 4,
                height: TRACK_H,
                width: trackWidth,
              }}
              onPointerDown={onTrackPointerDown}
            >
              <div className="pointer-events-none absolute inset-0 flex items-end gap-[2px] px-1 pb-3 opacity-80">
                {WAVEFORM.map((h, i) => (
                  <div
                    key={i}
                    className="w-[3px] shrink-0 rounded-sm bg-white"
                    style={{ height: `${h * 72}%` }}
                  />
                ))}
              </div>

              {markerLayouts.map(({ marker, left, width, thumbnail }) => (
                <TimelineMarker
                  key={marker.id}
                  marker={marker}
                  left={left}
                  width={width}
                  thumbnail={thumbnail}
                  selected={marker.id === selectedId}
                  onSelect={() => onSelect(marker.id)}
                  onPointerDown={(e) => onMarkerPointerDown(e, marker)}
                />
              ))}
            </div>

            <Playhead
              left={playheadLeft}
              timeLabel={formatTimecode(playheadLabels.episodeTime)}
              episodeReady={episodeReady}
              onScrubStart={onPlayheadPointerDown}
            />
          </div>

          <div className="relative mt-1 border-t border-[#f3f4f6] pt-1" style={{ height: RULER_H }}>
            {ticks.map((sec) => (
              <div
                key={sec}
                className="pointer-events-none absolute flex flex-col items-start"
                style={{ left: sec * pixelsPerSecond }}
              >
                <span className="mb-0.5 h-1.5 w-px bg-[#d1d5db]" />
                <span className="pl-0.5 text-[10px] tabular-nums text-[#9ca3af]">
                  {formatTimecode(sec)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
