import { describe, expect, it } from "vitest";
import { episodeSegmentAfterAd } from "./ad-playback";
import { buildTimeline } from "./playback";
import {
  episodeTimeToTimeline,
  findActiveEpisodeSegmentAtTime,
  segmentAfter,
  syncEpisodePlayback,
} from "./playback-sync";
import type { Ad, AdMarker } from "./types";

const catalog: Ad[] = [
  { id: "ad-1", name: "A1", filename: "ads/sample-ad-1.mp4", duration: 10 },
];

const markers: AdMarker[] = [
  { id: "m1", startTime: 30, mode: "static", adIds: ["ad-1"] },
];

describe("playback-sync", () => {
  it("maps episode video time to timeline position", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const epSeg = findActiveEpisodeSegmentAtTime(45, segments);
    expect(epSeg).not.toBeNull();
    const tl = episodeTimeToTimeline(45, epSeg!);
    expect(tl).toBe(55);
  });

  it("detects episode segment end and next ad", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const epSeg = findActiveEpisodeSegmentAtTime(29.95, segments);
    expect(epSeg?.episodeEnd).toBe(30);
    const next = segmentAfter(epSeg!, segments);
    expect(next?.type).toBe("ad");
    const sync = syncEpisodePlayback(29.95, segments);
    expect(sync.shouldTransitionToAd).toBe(true);
  });

  it("uses post-ad segment after resume, not pre-ad overdue", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const sync = syncEpisodePlayback(31, segments);
    expect(sync.shouldTransitionToAd).toBe(false);
    expect(sync.timelineTime).toBe(41);
    expect(sync.episodeSegment?.episodeStart).toBe(30);
  });

  it("does not transition before ad marker", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const sync = syncEpisodePlayback(25, segments);
    expect(sync.shouldTransitionToAd).toBe(false);
    expect(sync.timelineTime).toBe(25);
  });

  it("does not re-trigger ad when resuming episode at marker time", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const sync = syncEpisodePlayback(30, segments);
    expect(sync.shouldTransitionToAd).toBe(false);
    expect(sync.timelineTime).toBe(40);
    expect(sync.episodeSegment?.episodeStart).toBe(30);
  });

  it("advances timeline through post-ad content", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const sync = syncEpisodePlayback(60, segments);
    expect(sync.shouldTransitionToAd).toBe(false);
    expect(sync.timelineTime).toBe(70);
  });

  it("maps timeline at ad block end to episode resume segment", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const adSeg = segments.find((s) => s.type === "ad")!;
    const resume = episodeSegmentAfterAd(adSeg, segments);
    expect(resume?.timelineStart).toBe(adSeg.timelineEnd);
    expect(resume?.episodeStart).toBe(30);
  });

  it("after ad, next segment is episode resume", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const adSeg = segments.find((s) => s.type === "ad");
    expect(adSeg).toBeDefined();
    const next = segmentAfter(adSeg!, segments);
    expect(next?.type).toBe("episode");
    if (next?.type === "episode") {
      expect(next.episodeStart).toBe(30);
    }
  });
});
