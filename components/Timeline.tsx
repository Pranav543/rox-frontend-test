"use client";

import { formatTimecode } from "@/lib/format-time";
import type { AdPerformance } from "@/lib/marker-config";
import { resolveAdForMarker } from "@/lib/marker-config";
import { adDurationFor, buildTimeline } from "@/lib/playback";
import type { TimelineSegment } from "@/lib/timeline-build";
import {
  buildTimelineExcludingMarker,
  episodeMarkerToTimeline,
  episodeTimeFromPixelDelta,
  getPlayheadLabels,
} from "@/lib/timeline-mapping";
import { mediaUrl } from "@/lib/ads";
import { EPISODE_LANE, MODE_COLORS, generateWaveformBars } from "@/lib/timeline-visual";
import type { Ad, AdMarker } from "@/lib/types";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const MIN_PPS = 4;
const MAX_PPS = 48;
const TRACK_H_MAX = 140;
const TRACK_H_MIN = 92;
const TRACK_H_FLOOR = 72;
const TRACK_FRAME = 5;
const SEG_GAP = 2;
const SEG_RADIUS = 4;
const RULER_GAP = 2;
const RULER_TICK_H = 14;
const RULER_LABEL_H = 14;
const PLAYHEAD_HANDLE_W = 22;
const PLAYHEAD_HANDLE_H = 20;
const PLAYHEAD_TOP_PAD = 5;
const SCROLL_PADDING_TOP = 8;
const SCROLL_PADDING_BOTTOM = 14;
const SCROLL_PADDING_V = SCROLL_PADDING_TOP + SCROLL_PADDING_BOTTOM;
const SCROLL_BODY_DEFAULT = 232;
const ZOOM_THUMB = 14;
const ZOOM_TRACK = 4;

type TimelineLayoutMetrics = {
  trackH: number;
  rulerH: number;
  rulerGap: number;
  playheadHandleH: number;
  playheadTopPad: number;
  trackLineEnd: number;
  totalContentH: number;
  scrollBodyH: number;
};

function computeTimelineMetrics(scrollBudget: number): TimelineLayoutMetrics {
  const innerBudget = Math.max(160, scrollBudget - SCROLL_PADDING_V);
  const playheadTopPad = PLAYHEAD_TOP_PAD;
  const playheadHandleH = PLAYHEAD_HANDLE_H;
  const rulerGap = RULER_GAP;
  const rulerH = RULER_TICK_H + RULER_LABEL_H;
  const trackChrome =
    playheadTopPad + playheadHandleH + TRACK_FRAME * 2 + 4 + rulerGap + rulerH;
  const trackH = Math.round(
    Math.min(
      TRACK_H_MAX,
      Math.max(TRACK_H_FLOOR, innerBudget - trackChrome)
    )
  );
  const trackLineEnd = playheadTopPad + playheadHandleH + TRACK_FRAME * 2 + trackH;
  const trackClusterH = trackLineEnd + 4;
  const totalContentH = trackClusterH + rulerGap + rulerH;
  const scrollBodyH = totalContentH + SCROLL_PADDING_V;

  return {
    trackH,
    rulerH,
    rulerGap,
    playheadHandleH,
    playheadTopPad,
    trackLineEnd,
    totalContentH,
    scrollBodyH,
  };
}

function minimumScrollBudget(): number {
  const trackLineEnd =
    PLAYHEAD_TOP_PAD + PLAYHEAD_HANDLE_H + TRACK_FRAME * 2 + TRACK_H_MIN;
  const totalContentH =
    trackLineEnd + 4 + RULER_GAP + RULER_TICK_H + RULER_LABEL_H;
  return totalContentH + SCROLL_PADDING_V;
}

function timelineBodyBudget(maxScrollBodyH?: number): number {
  if (typeof window === "undefined") return SCROLL_BODY_DEFAULT;
  const needed = minimumScrollBudget();
  const vhBased = Math.round(window.innerHeight * 0.21);
  let budget = Math.max(needed, vhBased);
  if (maxScrollBodyH !== undefined) {
    budget = Math.min(budget, Math.max(120, maxScrollBodyH));
  }
  return budget;
}

function visualSpan(
  timelineStart: number,
  timelineDuration: number,
  totalDuration: number,
  pixelsPerSecond: number
) {
  const hasBefore = timelineStart > 0.001;
  const hasAfter = timelineStart + timelineDuration < totalDuration - 0.001;
  const baseLeft = timelineStart * pixelsPerSecond;
  const baseWidth = timelineDuration * pixelsPerSecond;
  return {
    left: baseLeft + (hasBefore ? SEG_GAP : 0),
    width: Math.max(
      2,
      baseWidth - (hasBefore ? SEG_GAP : 0) - (hasAfter ? SEG_GAP : 0)
    ),
  };
}

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
  maxCardHeight?: number;
};

type DragState = {
  id: string;
  pointerId: number;
  startX: number;
  initialEpisodeTime: number;
};

function IconUndo() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M4.5 2.5L2 5l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 5h4.5a2.5 2.5 0 1 1 0 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRedo() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M5.5 2.5L8 5 5.5 7.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 5H3.5a2.5 2.5 0 1 0 0 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconZoomOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M5 7h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function IconZoomIn() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function HistoryButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex items-center gap-2 transition hover:opacity-80 disabled:opacity-30"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#d1d5db] text-[#6b7280]">
        {icon}
      </span>
      <span className="text-[13px] font-normal text-[#9ca3af]">{label}</span>
    </button>
  );
}

function ZoomSlider({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex w-[220px] items-center gap-3">
      <span className="shrink-0 text-[#9ca3af]">
        <IconZoomOut />
      </span>
      <div
        className="relative flex flex-1 items-center"
        style={{ height: ZOOM_THUMB }}
      >
        <div
          className="absolute left-0 right-0 rounded-full bg-white"
          style={{ height: ZOOM_TRACK, top: "50%", transform: "translateY(-50%)" }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#d1d5db]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="pointer-events-none absolute rounded-full bg-[#1a1a1a]"
          style={{
            width: ZOOM_THUMB,
            height: ZOOM_THUMB,
            left: `${pct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute left-0 w-full cursor-pointer opacity-0"
          style={{
            height: ZOOM_THUMB,
            top: "50%",
            transform: "translateY(-50%)",
          }}
          aria-label="Timeline zoom"
        />
      </div>
      <span className="shrink-0 text-[#9ca3af]">
        <IconZoomIn />
      </span>
    </div>
  );
}

function MarkerGrip({ color }: { color: string }) {
  const dotR = 2.25;
  const gap = 4.5;
  const cols = 2;
  const rows = 3;
  const w = cols * dotR * 2 + (cols - 1) * gap;
  const h = rows * dotR * 2 + (rows - 1) * gap;
  const dots: { cx: number; cy: number }[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      dots.push({
        cx: dotR + col * (dotR * 2 + gap),
        cy: dotR + row * (dotR * 2 + gap),
      });
    }
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="block shrink-0"
      aria-hidden
    >
      {dots.map((dot, i) => (
        <circle key={i} cx={dot.cx} cy={dot.cy} r={dotR} fill={color} />
      ))}
    </svg>
  );
}

function EpisodeWaveformLane({
  left,
  width,
  seed,
}: {
  left: number;
  width: number;
  seed: number;
}) {
  const barCount = Math.max(12, Math.floor(width / 3));
  const bars = useMemo(() => generateWaveformBars(barCount, seed), [barCount, seed]);

  if (width < 2) return null;

  return (
    <div
      className={`pointer-events-none absolute top-0 overflow-hidden ${EPISODE_LANE.bg}`}
      style={{
        left,
        width,
        height: "100%",
        borderRadius: SEG_RADIUS,
      }}
    >
      <div className="flex h-full w-full items-end gap-[2px] px-2 pb-2">
        {bars.map((h, i) => (
          <div
            key={i}
            className={`min-w-0 flex-1 rounded-[1px] ${EPISODE_LANE.bar}`}
            style={{ height: `${Math.max(14, h * 78)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function MarkerBadge({
  mode,
  icon,
  badgeBorder,
  text,
}: {
  mode: AdMarker["mode"];
  icon: string;
  badgeBorder: string;
  text: string;
}) {
  return (
    <span
      className={`flex h-[20px] min-w-[20px] items-center justify-center rounded-[4px] border-2 bg-transparent px-1 text-[9px] font-bold leading-none ${badgeBorder} ${text} ${
        mode === "ab" ? "min-w-[30px]" : ""
      }`}
    >
      {icon}
    </span>
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
  const blockW = Math.max(width, 56);
  const showThumbnail = Boolean(thumbnail && blockW > 56);

  return (
    <div
      data-marker
      role="button"
      tabIndex={0}
      style={{
        left,
        width: blockW,
        height: "100%",
        zIndex: selected ? 25 : 20,
        borderRadius: SEG_RADIUS,
      }}
      className={`absolute top-0 cursor-grab touch-none transition-[left,width] duration-200 ease-out ${colors.track} select-none active:cursor-grabbing ${
        selected ? "z-30 shadow-md" : ""
      }`}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="grid h-full w-full grid-rows-3">
        <div className="flex items-center justify-center">
          <MarkerBadge
            mode={marker.mode}
            icon={colors.icon}
            badgeBorder={colors.badgeBorder}
            text={colors.text}
          />
        </div>

        {showThumbnail ? (
          <div className="flex w-full items-center">
            <div className="flex h-full w-full flex-col border-y-[3px] border-black bg-black">
              <video
                className="h-full min-h-0 w-full flex-1 object-cover"
                src={thumbnail}
                muted
                preload="metadata"
              />
            </div>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center justify-center">
          <MarkerGrip color={colors.gripColor} />
        </div>
      </div>
    </div>
  );
}

function Playhead({
  left,
  timeLabel,
  episodeReady,
  playheadTopPad,
  playheadHandleH,
  trackLineEnd,
  onScrubStart,
}: {
  left: number;
  timeLabel: string;
  episodeReady: boolean;
  playheadTopPad: number;
  playheadHandleH: number;
  trackLineEnd: number;
  onScrubStart: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      data-playhead
      className="pointer-events-none absolute z-50"
      style={{
        left,
        top: playheadTopPad,
        height: trackLineEnd - playheadTopPad,
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
          className="flex w-full items-center justify-center rounded-[4px] border-2 border-[#dc2626] bg-[#ef4444]"
          style={{ height: playheadHandleH }}
        >
          <div className="grid w-fit grid-cols-2 gap-[2.5px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="h-[3px] w-[3px] rounded-full bg-white" />
            ))}
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute left-0 w-[2px] -translate-x-1/2 bg-[#ef4444]"
        style={{ top: playheadHandleH - 1, bottom: 0 }}
      />
    </div>
  );
}

function TimeRuler({
  totalDuration,
  pixelsPerSecond,
  trackWidth,
  frameOffset,
  rulerH,
  highlight,
}: {
  totalDuration: number;
  pixelsPerSecond: number;
  trackWidth: number;
  frameOffset: number;
  rulerH: number;
  highlight?: { left: number; width: number } | null;
}) {
  const ticks = useMemo(() => {
    const step = pixelsPerSecond >= 12 ? 10 : pixelsPerSecond >= 6 ? 30 : 60;
    const items: { sec: number; kind: "major" | "medium" | "minor" }[] = [];
    for (let sec = 0; sec <= totalDuration; sec += step) {
      const isMajor = sec % 60 === 0;
      const isMedium = sec % 30 === 0 && !isMajor;
      items.push({
        sec,
        kind: isMajor ? "major" : isMedium ? "medium" : "minor",
      });
    }
    return items;
  }, [totalDuration, pixelsPerSecond]);

  const tickAreaH = RULER_TICK_H;
  const labelAreaH = RULER_LABEL_H;

  return (
    <div
      className="relative flex flex-col"
      style={{ height: rulerH, width: trackWidth }}
    >
      {highlight && highlight.width > 0 ? (
        <div
          className="pointer-events-none absolute top-0 h-[7px] rounded-sm bg-[#e5e7eb]"
          style={{
            left: highlight.left + frameOffset,
            width: highlight.width,
          }}
        >
          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#e5e7eb]" />
        </div>
      ) : null}

      <div className="relative shrink-0" style={{ height: tickAreaH }}>
        {ticks.map(({ sec, kind }) => {
          const left = sec * pixelsPerSecond + frameOffset;
          const tickH =
            kind === "major" ? 12 : kind === "medium" ? 8 : 5;

          return (
            <div
              key={sec}
              className="pointer-events-none absolute"
              style={{ left, bottom: 0 }}
            >
              <span
                className={`block w-px ${kind === "major" ? "bg-[#9ca3af]" : "bg-[#d1d5db]"}`}
                style={{ height: tickH }}
              />
            </div>
          );
        })}
      </div>
      <div className="relative shrink-0" style={{ height: labelAreaH }}>
        {ticks
          .filter(({ sec }) => sec % 60 === 0)
          .map(({ sec }) => {
            const left = sec * pixelsPerSecond + frameOffset;
            return (
              <span
                key={`label-${sec}`}
                className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums leading-[14px] text-[#9ca3af]"
                style={{ left, top: 0 }}
              >
                {formatTimecode(sec)}
              </span>
            );
          })}
      </div>
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
  maxCardHeight,
}: TimelineProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [layoutMetrics, setLayoutMetrics] = useState<TimelineLayoutMetrics>(() =>
    computeTimelineMetrics(SCROLL_BODY_DEFAULT)
  );
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
    const update = () => {
      const toolbar = toolbarRef.current;
      let scrollCap: number | undefined;
      if (maxCardHeight !== undefined && toolbar) {
        scrollCap = maxCardHeight - toolbar.offsetHeight;
      }
      setLayoutMetrics(computeTimelineMetrics(timelineBodyBudget(scrollCap)));
    };

    update();
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
    };
  }, [maxCardHeight]);

  const {
    trackH,
    rulerH,
    rulerGap,
    playheadHandleH,
    playheadTopPad,
    trackLineEnd,
    totalContentH,
    scrollBodyH,
  } = layoutMetrics;
  const trackClusterH = trackLineEnd + 4;
  const trackFrameTop = playheadTopPad + playheadHandleH;

  const handleZoomChange = useCallback(
    (newPps: number) => {
      const scroll = scrollRef.current;
      onZoom(newPps);
      if (scroll && episodeReady && totalDuration > 0) {
        const playheadX = timelineTime * newPps;
        requestAnimationFrame(() => {
          scroll.scrollLeft = Math.max(
            0,
            playheadX - scroll.clientWidth / 2
          );
        });
      }
    },
    [episodeReady, onZoom, timelineTime, totalDuration]
  );

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
      const adDur = adDurationFor(adsCatalog, adId);
      const layout = visualSpan(tl, adDur, totalDuration, pixelsPerSecond);
      return {
        marker: m,
        left: layout.left,
        width: layout.width,
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
    totalDuration,
  ]);

  const selectedHighlight = useMemo(() => {
    const sel = markerLayouts.find((l) => l.marker.id === selectedId);
    if (!sel) return null;
    return { left: sel.left, width: Math.max(sel.width, 56) };
  }, [markerLayouts, selectedId]);

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
      window.removeEventListener("pointercancel", onUp);
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

  return (
    <div
      ref={cardRef}
      className="flex w-full shrink-0 flex-col rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    >
      <div
        ref={toolbarRef}
        className="relative flex shrink-0 items-center border-b border-[#f3f4f6] px-5 py-2.5"
      >
        <div className="flex items-center gap-8">
          <HistoryButton
            label="Undo"
            icon={<IconUndo />}
            disabled={!canUndo}
            onClick={onUndo}
          />
          <HistoryButton
            label="Redo"
            icon={<IconRedo />}
            disabled={!canRedo}
            onClick={onRedo}
          />
        </div>

        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-sm border border-[#e5e7eb] bg-white px-4 py-1.5 font-mono text-[13px] font-medium tabular-nums text-[#111827]">
          {formatTimecode(playheadLabels.episodeTime)}
        </div>

        <div className="ml-auto">
          <ZoomSlider
            value={pixelsPerSecond}
            min={MIN_PPS}
            max={MAX_PPS}
            onChange={handleZoomChange}
          />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="timeline-scroll overflow-x-auto overflow-y-hidden px-5"
        style={{
          height: scrollBodyH,
          paddingTop: SCROLL_PADDING_TOP,
          paddingBottom: SCROLL_PADDING_BOTTOM,
        }}
      >
        <div
          className="relative shrink-0"
          style={{
            width: trackWidth + TRACK_FRAME * 2,
            minWidth: "100%",
            height: totalContentH,
          }}
        >
          <div
            className="relative"
            style={{
              width: trackWidth + TRACK_FRAME * 2,
              height: trackClusterH,
            }}
          >
            <div
              className="absolute left-0 rounded-2xl bg-black p-[5px]"
              style={{ top: trackFrameTop }}
            >
              <div
                ref={trackRef}
                className="relative cursor-pointer rounded-[10px] bg-black"
                style={{ width: trackWidth, height: trackH }}
                onPointerDown={onTrackPointerDown}
              >
                {segments.map((seg, i) => {
                  if (seg.type !== "episode") return null;
                  const duration = seg.timelineEnd - seg.timelineStart;
                  const layout = visualSpan(
                    seg.timelineStart,
                    duration,
                    totalDuration,
                    pixelsPerSecond
                  );
                  return (
                    <EpisodeWaveformLane
                      key={`${seg.timelineStart}-${seg.episodeStart}`}
                      left={layout.left}
                      width={layout.width}
                      seed={42 + i * 17}
                    />
                  );
                })}

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
            </div>
          </div>

          <Playhead
            left={playheadLeft + TRACK_FRAME}
            timeLabel={formatTimecode(playheadLabels.episodeTime)}
            episodeReady={episodeReady}
            playheadTopPad={playheadTopPad}
            playheadHandleH={playheadHandleH}
            trackLineEnd={trackLineEnd}
            onScrubStart={onPlayheadPointerDown}
          />

          <div
            className="absolute left-0"
            style={{
              top: trackClusterH + rulerGap,
              width: trackWidth + TRACK_FRAME * 2,
              height: rulerH,
            }}
          >
            <TimeRuler
              totalDuration={totalDuration}
              pixelsPerSecond={pixelsPerSecond}
              trackWidth={trackWidth + TRACK_FRAME * 2}
              frameOffset={TRACK_FRAME}
              rulerH={rulerH}
              highlight={selectedHighlight}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
