/**
 * Assignment checklist — pure-logic verification (run with npm test).
 * UI flows: upload video → add marker → pick ad → play through ad → scrub timeline.
 */
import { describe, expect, it } from "vitest";
import { episodeSegmentAfterAd, isAdVideoFinished } from "./ad-playback";
import { resolveAdForMarker } from "./marker-config";
import { buildTimeline } from "./playback";
import { segmentAtTimelineTime } from "./playback-segment";
import { syncEpisodePlayback } from "./playback-sync";
import type { Ad, AdMarker } from "./types";

const catalog: Ad[] = [
  { id: "ad-1", name: "A1", filename: "ads/a.mp4", duration: 10 },
  { id: "ad-2", name: "A2", filename: "ads/b.mp4", duration: 12 },
  { id: "ad-4", name: "A4", filename: "ads/d.mp4", duration: 15 },
];

const PERF = {
  "ad-1": { ctr: 0.02, completions: 1, label: "A1" },
  "ad-4": { ctr: 0.08, completions: 1, label: "A4" },
};

describe("assignment: ad marker modes", () => {
  it("static uses exact ad", () => {
    const m: AdMarker = {
      id: "1",
      startTime: 10,
      mode: "static",
      adIds: ["ad-2"],
    };
    expect(resolveAdForMarker(m)).toBe("ad-2");
  });

  it("auto picks from pool on playback", () => {
    const m: AdMarker = {
      id: "1",
      startTime: 0,
      mode: "auto",
      adIds: ["ad-1", "ad-2"],
    };
    const picks = new Set(
      [0, 0.25, 0.5, 0.75, 0.99].map((r) =>
        resolveAdForMarker(m, { forPlayback: true, random: () => r })
      )
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it("A/B picks highest CTR", () => {
    const m: AdMarker = {
      id: "1",
      startTime: 0,
      mode: "ab",
      adIds: ["ad-1", "ad-4"],
    };
    expect(resolveAdForMarker(m, { performance: PERF })).toBe("ad-4");
  });
});

describe("assignment: timeline + playback", () => {
  const markers: AdMarker[] = [
    { id: "m1", startTime: 30, mode: "static", adIds: ["ad-1"] },
  ];

  it("builds expanded timeline with ad slot", () => {
    const { totalDuration, segments } = buildTimeline(
      markers,
      120,
      catalog,
      PERF
    );
    expect(totalDuration).toBeGreaterThan(120);
    expect(segments.some((s) => s.type === "ad")).toBe(true);
  });

  it("pre-ad scrub maps 1:1", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    expect(syncEpisodePlayback(15, segments).timelineTime).toBe(15);
  });

  it("transitions into ad near marker end", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const sync = syncEpisodePlayback(29.92, segments);
    expect(sync.shouldTransitionToAd).toBe(true);
  });

  it("post-ad playback advances timeline (no loop)", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const at45 = syncEpisodePlayback(45, segments);
    expect(at45.shouldTransitionToAd).toBe(false);
    expect(at45.timelineTime).toBe(55);

    const at60 = syncEpisodePlayback(60, segments);
    expect(at60.shouldTransitionToAd).toBe(false);
    expect(at60.timelineTime).toBe(70);
  });

  it("ad ends on real video duration", () => {
    expect(isAdVideoFinished(5.7, 5.76)).toBe(true);
  });

  it("resume segment after ad", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    const ad = segments.find((s) => s.type === "ad")!;
    const resume = episodeSegmentAfterAd(ad, segments);
    expect(resume?.episodeStart).toBe(30);
  });

  it("timeline seek after ad lands on episode block", () => {
    const { segments } = buildTimeline(markers, 120, catalog);
    expect(segmentAtTimelineTime(70, segments)?.type).toBe("episode");
  });
});
