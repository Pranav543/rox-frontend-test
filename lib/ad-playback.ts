import type { TimelineSegment } from "./playback";

export type AdTimelineSegment = Extract<TimelineSegment, { type: "ad" }>;
export type EpisodeTimelineSegment = Extract<TimelineSegment, { type: "episode" }>;

export function findAdSegmentIndex(
  adSeg: AdTimelineSegment,
  segments: TimelineSegment[]
): number {
  return segments.findIndex(
    (s) => s.type === "ad" && s.markerId === adSeg.markerId
  );
}

/** Episode segment that plays immediately after this ad block */
export function episodeSegmentAfterAd(
  adSeg: AdTimelineSegment,
  segments: TimelineSegment[]
): EpisodeTimelineSegment | null {
  const idx = findAdSegmentIndex(adSeg, segments);
  if (idx < 0 || idx >= segments.length - 1) return null;
  const next = segments[idx + 1];
  return next.type === "episode" ? next : null;
}

/** Ad break ends when the ad file reaches its end (real duration, not catalog slot). */
export function isAdVideoFinished(
  videoCurrentTime: number,
  videoDuration: number
): boolean {
  if (!Number.isFinite(videoDuration) || videoDuration <= 0) return false;
  return videoCurrentTime >= videoDuration - 0.1 || videoCurrentTime >= videoDuration;
}

export function timelineTimeDuringAd(
  adSeg: AdTimelineSegment,
  videoCurrentTime: number
): number {
  return Math.min(adSeg.timelineStart + videoCurrentTime, adSeg.timelineEnd);
}
