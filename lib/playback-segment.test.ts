import { describe, expect, it } from "vitest";
import { buildTimeline } from "./playback";
import { segmentAtTimelineTime } from "./playback-segment";
import type { Ad, AdMarker } from "./types";

const catalog: Ad[] = [
  { id: "ad-1", name: "A1", filename: "ads/sample-ad-1.mp4", duration: 10 },
];

const markers: AdMarker[] = [
  { id: "m1", startTime: 30, mode: "static", adIds: ["ad-1"] },
];

describe("segmentAtTimelineTime", () => {
  const { segments } = buildTimeline(markers, 120, catalog);

  it("picks episode before the ad", () => {
    expect(segmentAtTimelineTime(10, segments)?.type).toBe("episode");
  });

  it("picks ad inside the ad block", () => {
    expect(segmentAtTimelineTime(35, segments)?.type).toBe("ad");
  });

  it("picks episode after the ad, not ad at boundary", () => {
    const seg = segmentAtTimelineTime(40, segments);
    expect(seg?.type).toBe("episode");
    if (seg?.type === "episode") {
      expect(seg.episodeStart).toBe(30);
    }
  });
});
