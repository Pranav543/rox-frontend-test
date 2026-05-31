import { describe, expect, it } from "vitest";
import { buildTimeline } from "./playback";
import {
  episodeSegmentAfterAd,
  isAdVideoFinished,
  timelineTimeDuringAd,
} from "./ad-playback";
import type { Ad, AdMarker } from "./types";

const catalog: Ad[] = [
  { id: "ad-1", name: "A1", filename: "ads/sample-ad-1.mp4", duration: 15 },
];

const markers: AdMarker[] = [
  { id: "m1", startTime: 30, mode: "static", adIds: ["ad-1"] },
];

describe("ad-playback", () => {
  it("finds episode segment after ad", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const adSeg = segments.find((s) => s.type === "ad")!;
    const resume = episodeSegmentAfterAd(adSeg, segments);
    expect(resume?.episodeStart).toBe(30);
    expect(resume?.timelineStart).toBe(45);
  });

  it("finishes when video reaches end", () => {
    expect(isAdVideoFinished(5.7, 5.76)).toBe(true);
    expect(isAdVideoFinished(2, 10)).toBe(false);
  });

  it("caps timeline position at ad block end", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const adSeg = segments.find((s) => s.type === "ad")!;
    expect(timelineTimeDuringAd(adSeg, 99)).toBe(adSeg.timelineEnd);
  });
});
