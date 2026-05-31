import type { TimelineSegment } from "./playback";

/** Which segment owns this point on the expanded timeline */
export function segmentAtTimelineTime(
  t: number,
  segments: TimelineSegment[]
): TimelineSegment | null {
  if (segments.length === 0) return null;

  const clamped = Math.max(
    0,
    Math.min(t, segments[segments.length - 1].timelineEnd)
  );

  for (const seg of segments) {
    if (clamped >= seg.timelineStart && clamped < seg.timelineEnd) {
      return seg;
    }
  }

  return segments[segments.length - 1];
}

export function episodeTimeForTimeline(
  t: number,
  seg: Extract<TimelineSegment, { type: "episode" }>
): number {
  return seg.episodeStart + (t - seg.timelineStart);
}
