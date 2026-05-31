import type { TimelineSegment } from "./playback";

/** Episode segment containing this episode timestamp */
export function findEpisodeSegmentAtEpisodeTime(
  episodeTime: number,
  segments: TimelineSegment[]
): Extract<TimelineSegment, { type: "episode" }> | null {
  for (const seg of segments) {
    if (
      seg.type === "episode" &&
      episodeTime >= seg.episodeStart &&
      episodeTime < seg.episodeEnd - 0.001
    ) {
      return seg;
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
      t <= seg.timelineEnd + 0.05
    ) {
      return seg;
    }
  }
  return null;
}

/** Ad segment for the current ad video (timeline at/near ad block end). */
export function findAdSegmentForAdPlayback(
  timelineTime: number,
  segments: TimelineSegment[]
): Extract<TimelineSegment, { type: "ad" }> | null {
  const exact = findAdSegmentAtTimeline(timelineTime, segments);
  if (exact) return exact;

  let candidate: Extract<TimelineSegment, { type: "ad" }> | null = null;
  for (const seg of segments) {
    if (seg.type === "ad" && timelineTime >= seg.timelineStart) {
      candidate = seg;
    }
  }
  return candidate;
}

const EPISODE_END_EPS = 0.15;

export type EpisodePlaybackSync = {
  episodeSegment: Extract<TimelineSegment, { type: "episode" }> | null;
  timelineTime: number;
  shouldTransitionToAd: boolean;
  adSegment: Extract<TimelineSegment, { type: "ad" }> | null;
};

/**
 * Map raw episode file time → timeline playhead while the episode video element is playing.
 * Detects missed ad boundaries when timeupdate jumps past a marker.
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

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type !== "episode") continue;

    const next = segmentAfter(seg, segments);
    const inRange =
      episodeTime >= seg.episodeStart && episodeTime < seg.episodeEnd;

    if (inRange) {
      const shouldTransitionToAd =
        next?.type === "ad" && episodeTime >= seg.episodeEnd - EPISODE_END_EPS;
      return {
        episodeSegment: seg,
        timelineTime: episodeTimeToTimeline(episodeTime, seg),
        shouldTransitionToAd,
        adSegment: shouldTransitionToAd && next.type === "ad" ? next : null,
      };
    }

    // Only when playback jumped past the pre-ad episode block without playing the ad
    if (next?.type === "ad" && episodeTime > seg.episodeEnd) {
      return {
        episodeSegment: seg,
        timelineTime: next.timelineStart,
        shouldTransitionToAd: true,
        adSegment: next,
      };
    }
  }

  const last = segments[segments.length - 1];
  return {
    episodeSegment:
      last.type === "episode"
        ? last
        : findEpisodeSegmentAtEpisodeTime(episodeTime, segments),
    timelineTime:
      last.type === "episode"
        ? episodeTimeToTimeline(
            Math.min(episodeTime, last.episodeEnd),
            last
          )
        : last.timelineEnd,
    shouldTransitionToAd: false,
    adSegment: null,
  };
}
