import type { TimelineSegment } from "./timeline-build";

/** Episode segment containing this episode timestamp */
export function findEpisodeSegmentAtEpisodeTime(
  episodeTime: number,
  segments: TimelineSegment[]
): Extract<TimelineSegment, { type: "episode" }> | null {
  return findActiveEpisodeSegmentAtTime(episodeTime, segments);
}

/**
 * Which episode block owns this file timestamp.
 * When pre-ad ends and post-ad starts at the same second (e.g. 30s), prefer the post-ad block.
 */
export function findActiveEpisodeSegmentAtTime(
  episodeTime: number,
  segments: TimelineSegment[]
): Extract<TimelineSegment, { type: "episode" }> | null {
  let best: Extract<TimelineSegment, { type: "episode" }> | null = null;

  for (const seg of segments) {
    if (seg.type !== "episode") continue;
    if (episodeTime >= seg.episodeStart && episodeTime < seg.episodeEnd - 0.001) {
      if (!best || seg.episodeStart > best.episodeStart) {
        best = seg;
      }
    }
  }

  if (best) return best;

  for (const seg of segments) {
    if (seg.type !== "episode") continue;
    if (Math.abs(episodeTime - seg.episodeEnd) < 0.02) {
      if (!best || seg.episodeStart > best.episodeStart) {
        best = seg;
      }
    }
  }

  let last: Extract<TimelineSegment, { type: "episode" }> | null = null;
  for (const seg of segments) {
    if (seg.type === "episode" && episodeTime >= seg.episodeStart) {
      last = seg;
    }
  }
  return last;
}

export function episodeTimeToTimeline(
  episodeTime: number,
  epSeg: Extract<TimelineSegment, { type: "episode" }>
): number {
  return epSeg.timelineStart + (episodeTime - epSeg.episodeStart);
}

export function segmentAfter(
  seg: TimelineSegment,
  segments: TimelineSegment[]
): TimelineSegment | null {
  const idx = segments.indexOf(seg);
  return idx >= 0 && idx < segments.length - 1 ? segments[idx + 1] : null;
}

export function findAdSegmentAtTimeline(
  t: number,
  segments: TimelineSegment[]
): Extract<TimelineSegment, { type: "ad" }> | null {
  for (const seg of segments) {
    if (
      seg.type === "ad" &&
      t >= seg.timelineStart &&
      t < seg.timelineEnd
    ) {
      return seg;
    }
  }
  return null;
}

const EPISODE_END_EPS = 0.15;

export type EpisodePlaybackSync = {
  episodeSegment: Extract<TimelineSegment, { type: "episode" }> | null;
  timelineTime: number;
  shouldTransitionToAd: boolean;
  adSegment: Extract<TimelineSegment, { type: "ad" }> | null;
};

/**
 * Map episode file time → timeline playhead while the main video is playing.
 */
export function syncEpisodePlayback(
  episodeTime: number,
  segments: TimelineSegment[]
): EpisodePlaybackSync {
  if (segments.length === 0) {
    return {
      episodeSegment: null,
      timelineTime: 0,
      shouldTransitionToAd: false,
      adSegment: null,
    };
  }

  const epSeg = findActiveEpisodeSegmentAtTime(episodeTime, segments);
  if (!epSeg) {
    const last = segments[segments.length - 1];
    return {
      episodeSegment: null,
      timelineTime:
        last.type === "episode" ? last.timelineEnd : last.timelineEnd,
      shouldTransitionToAd: false,
      adSegment: null,
    };
  }

  const next = segmentAfter(epSeg, segments);
  const nearEndOfThisEpisodeBlock =
    episodeTime >= epSeg.episodeEnd - EPISODE_END_EPS &&
    episodeTime < epSeg.episodeEnd;
  const shouldTransitionToAd =
    next?.type === "ad" && nearEndOfThisEpisodeBlock;

  return {
    episodeSegment: epSeg,
    timelineTime: episodeTimeToTimeline(episodeTime, epSeg),
    shouldTransitionToAd,
    adSegment: shouldTransitionToAd && next.type === "ad" ? next : null,
  };
}
