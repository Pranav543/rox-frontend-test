import type { AdPerformance } from "./marker-config";
import { resolveAdForMarker } from "./marker-config";
import type { Ad, AdMarker, AdMode } from "./types";

export function adDurationFor(catalog: Ad[], id: string): number {
  return catalog.find((a) => a.id === id)?.duration ?? 15;
}

export type TimelineSegment =
  | {
      type: "episode";
      episodeStart: number;
      episodeEnd: number;
      timelineStart: number;
      timelineEnd: number;
    }
  | {
      type: "ad";
      markerId: string;
      adId: string;
      timelineStart: number;
      timelineEnd: number;
    };

export function buildTimeline(
  markers: AdMarker[],
  episodeDuration: number,
  catalog: Ad[] = [],
  performance: Record<string, AdPerformance> = {}
): { segments: TimelineSegment[]; totalDuration: number } {
  if (episodeDuration <= 0) {
    return { segments: [], totalDuration: 0 };
  }

  const sorted = [...markers].sort((a, b) => a.startTime - b.startTime);
  const segments: TimelineSegment[] = [];
  let timelineCursor = 0;
  let episodeCursor = 0;

  for (const marker of sorted) {
    const start = Math.min(Math.max(marker.startTime, 0), episodeDuration);
    if (start > episodeCursor) {
      const len = start - episodeCursor;
      segments.push({
        type: "episode",
        episodeStart: episodeCursor,
        episodeEnd: start,
        timelineStart: timelineCursor,
        timelineEnd: timelineCursor + len,
      });
      timelineCursor += len;
      episodeCursor = start;
    }

    if (!marker.adIds?.length) continue;
    const adId = resolveAdForMarker(marker, { performance });
    if (adId) {
      const len = adDurationFor(catalog, adId);
      segments.push({
        type: "ad",
        markerId: marker.id,
        adId,
        timelineStart: timelineCursor,
        timelineEnd: timelineCursor + len,
      });
      timelineCursor += len;
    }
  }

  if (episodeCursor < episodeDuration) {
    segments.push({
      type: "episode",
      episodeStart: episodeCursor,
      episodeEnd: episodeDuration,
      timelineStart: timelineCursor,
      timelineEnd: timelineCursor + (episodeDuration - episodeCursor),
    });
    timelineCursor += episodeDuration - episodeCursor;
  }

  return { segments, totalDuration: timelineCursor };
}

export function timelineToEpisodeTime(
  t: number,
  segments: TimelineSegment[]
):
  | { kind: "episode"; episodeTime: number }
  | { kind: "ad"; segment: Extract<TimelineSegment, { type: "ad" }> }
  | null {
  if (segments.length === 0) return { kind: "episode", episodeTime: t };

  for (const seg of segments) {
    if (t >= seg.timelineStart && t < seg.timelineEnd) {
      if (seg.type === "episode") {
        return {
          kind: "episode",
          episodeTime: seg.episodeStart + (t - seg.timelineStart),
        };
      }
      return { kind: "ad", segment: seg };
    }
  }

  const last = segments[segments.length - 1];
  if (t >= last.timelineEnd) {
    if (last.type === "episode") return { kind: "episode", episodeTime: last.episodeEnd };
    const prev = segments[segments.length - 2];
    if (prev?.type === "episode") return { kind: "episode", episodeTime: prev.episodeEnd };
  }
  return null;
}

/** Map timeline position → episode timestamp (for playhead label & marker drag) */
export function timelinePositionToEpisodeTime(
  t: number,
  segments: TimelineSegment[]
): number {
  const pos = timelineToEpisodeTime(t, segments);
  if (!pos) return 0;
  if (pos.kind === "episode") return pos.episodeTime;
  const adSeg = pos.segment;
  const idx = segments.indexOf(adSeg);
  if (idx > 0) {
    const prev = segments[idx - 1];
    if (prev.type === "episode") return prev.episodeEnd;
  }
  return 0;
}

/** Map timeline position → episode time for placing/moving markers (never lands inside ad blocks) */
export function timelinePositionToMarkerEpisodeTime(
  t: number,
  segments: TimelineSegment[],
  episodeDuration: number
): number {
  if (segments.length === 0) return Math.max(0, Math.min(t, episodeDuration));

  for (const seg of segments) {
    if (t >= seg.timelineStart && t < seg.timelineEnd) {
      if (seg.type === "episode") {
        return seg.episodeStart + (t - seg.timelineStart);
      }
      const idx = segments.indexOf(seg);
      const prev = segments[idx - 1];
      if (prev?.type === "episode") return prev.episodeEnd;
      return 0;
    }
  }

  const last = segments[segments.length - 1];
  if (last.type === "episode") return last.episodeEnd;
  const prev = segments[segments.length - 2];
  if (prev?.type === "episode") return prev.episodeEnd;
  return episodeDuration;
}

export function episodeMarkerToTimeline(
  markerStart: number,
  segments: TimelineSegment[]
): number {
  for (const seg of segments) {
    if (seg.type === "episode") {
      if (markerStart >= seg.episodeStart && markerStart <= seg.episodeEnd) {
        return seg.timelineStart + (markerStart - seg.episodeStart);
      }
      if (markerStart < seg.episodeStart) {
        return seg.timelineStart;
      }
    }
  }
  return markerStart;
}

/** Timeline segments for drag math — excludes the marker being moved */
export function buildTimelineExcludingMarker(
  markers: AdMarker[],
  excludeId: string,
  episodeDuration: number,
  catalog: Ad[] = [],
  performance: Record<string, AdPerformance> = {}
) {
  return buildTimeline(
    markers.filter((m) => m.id !== excludeId),
    episodeDuration,
    catalog,
    performance
  );
}

/** Convert horizontal pixel delta → episode seconds at a given episode position */
export function episodeSecondsPerPixel(
  episodeTime: number,
  segments: TimelineSegment[],
  episodeDuration: number,
  pixelsPerSecond: number
): number {
  if (pixelsPerSecond <= 0) return 1;
  const eps = 0.25;
  const t0 = episodeMarkerToTimeline(episodeTime, segments);
  const t1 = episodeMarkerToTimeline(
    Math.min(episodeTime + eps, episodeDuration),
    segments
  );
  const timelinePerEpisode = (t1 - t0) / eps;
  if (timelinePerEpisode <= 0) return 1 / pixelsPerSecond;
  return timelinePerEpisode / pixelsPerSecond;
}

export function episodeTimeFromPixelDelta(
  initialEpisodeTime: number,
  deltaPx: number,
  segments: TimelineSegment[],
  episodeDuration: number,
  pixelsPerSecond: number
): number {
  const secPerPx = episodeSecondsPerPixel(
    initialEpisodeTime,
    segments,
    episodeDuration,
    pixelsPerSecond
  );
  return initialEpisodeTime + deltaPx * secPerPx;
}

export function getPlayheadLabels(
  timelineTime: number,
  episodeDuration: number,
  segments: TimelineSegment[]
): { episodeTime: number; timelineTime: number; inAd: boolean; adLabel?: string } {
  const pos = timelineToEpisodeTime(timelineTime, segments);
  if (pos?.kind === "ad") {
    const ep = timelinePositionToEpisodeTime(timelineTime, segments);
    return {
      episodeTime: ep,
      timelineTime,
      inAd: true,
      adLabel: pos.segment.adId,
    };
  }
  const episodeTime =
    pos?.kind === "episode"
      ? pos.episodeTime
      : timelinePositionToEpisodeTime(timelineTime, segments);
  return {
    episodeTime: Math.min(episodeTime, episodeDuration || episodeTime),
    timelineTime,
    inAd: false,
  };
}

export const MODE_COLORS: Record<
  AdMode,
  { badge: string; track: string; border: string; text: string }
> = {
  static: {
    badge: "bg-green-200",
    track: "bg-green-300",
    border: "border-green-800",
    text: "text-green-900",
  },
  auto: {
    badge: "bg-blue-200",
    track: "bg-blue-300",
    border: "border-blue-800",
    text: "text-blue-900",
  },
  ab: {
    badge: "bg-orange-200",
    track: "bg-orange-300",
    border: "border-orange-800",
    text: "text-orange-900",
  },
};

export function generateWaveformBars(count: number, seed = 42): number[] {
  let s = seed;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    s = (s * 16807 + 0) % 2147483647;
    const r = (s % 1000) / 1000;
    bars.push(0.15 + r * 0.85);
  }
  return bars;
}
