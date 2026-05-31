import { describe, expect, it } from "vitest";
import { resolveAdForMarker } from "./marker-config";
import {
  buildTimeline,
  buildTimelineExcludingMarker,
  episodeTimeFromPixelDelta,
  timelinePositionToEpisodeTime,
} from "./playback";
import type { Ad, AdMarker } from "./types";

const catalog: Ad[] = [
  { id: "ad-1", name: "A1", filename: "ads/sample-ad-1.mp4", duration: 10 },
  { id: "ad-2", name: "A2", filename: "ads/sample-ad-2.mp4", duration: 12 },
  { id: "ad-4", name: "A4", filename: "ads/sample-ad-4.mp4", duration: 15 },
];

const PERF = {
  "ad-1": { ctr: 0.02, completions: 1, label: "A1" },
  "ad-4": { ctr: 0.06, completions: 1, label: "A4" },
};

describe("buildTimeline", () => {
  const markers: AdMarker[] = [
    { id: "m1", startTime: 30, mode: "static", adIds: ["ad-2"] },
    { id: "m2", startTime: 60, mode: "ab", adIds: ["ad-1", "ad-4"] },
  ];

  it("returns empty timeline when episode not loaded", () => {
    const { segments, totalDuration } = buildTimeline(markers, 0, catalog, PERF);
    expect(segments).toHaveLength(0);
    expect(totalDuration).toBe(0);
  });

  it("extends total duration with ad lengths", () => {
    const { totalDuration, segments } = buildTimeline(markers, 120, catalog, PERF);
    expect(totalDuration).toBe(30 + 12 + 30 + 15 + 60);
    expect(segments.filter((s) => s.type === "ad")).toHaveLength(2);
    const abSeg = segments.find((s) => s.type === "ad" && s.markerId === "m2");
    expect(abSeg?.type === "ad" && abSeg.adId).toBe("ad-4");
  });

  it("maps timeline position to episode time when dragging", () => {
    const { segments } = buildTimeline(markers, 120, catalog, PERF);
    const t = timelinePositionToEpisodeTime(45, segments);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThanOrEqual(60);
  });

  it("drag math excludes the marker being moved", () => {
    const { segments: all } = buildTimeline(markers, 120, catalog, PERF);
    const { segments: withoutM1 } = buildTimelineExcludingMarker(
      markers,
      "m1",
      120,
      catalog,
      PERF
    );
    expect(withoutM1.length).toBeLessThan(all.length);
    const moved = episodeTimeFromPixelDelta(30, 50, withoutM1, 120, 12);
    expect(moved).toBeGreaterThan(30);
    expect(moved).toBeLessThan(90);
  });
});

describe("static selection", () => {
  it("uses marker adIds not a default", () => {
    const m: AdMarker = { id: "x", startTime: 0, mode: "static", adIds: ["ad-2"] };
    expect(resolveAdForMarker(m)).toBe("ad-2");
  });
});
