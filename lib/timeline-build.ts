import type { AdPerformance } from "./marker-config";
import { resolveAdForMarker } from "./marker-config";
import type { Ad, AdMarker } from "./types";

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
