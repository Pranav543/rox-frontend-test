import { describe, expect, it } from "vitest";
import { buildExportPlan, resolveAdForExport } from "./export-plan";
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

describe("resolveAdForExport", () => {
  it("uses static first ad", () => {
    expect(
      resolveAdForExport(
        { id: "m", startTime: 0, mode: "static", adIds: ["ad-2", "ad-1"] },
        PERF
      )
    ).toBe("ad-2");
  });

  it("uses stable auto preview", () => {
    const id = resolveAdForExport(
      { id: "marker-abc", startTime: 0, mode: "auto", adIds: ["ad-1", "ad-2"] },
      PERF
    );
    expect(id).toBeTruthy();
    expect(["ad-1", "ad-2"]).toContain(id);
  });

  it("uses best A/B ad from performance", () => {
    expect(
      resolveAdForExport(
        { id: "m", startTime: 0, mode: "ab", adIds: ["ad-1", "ad-4"] },
        PERF
      )
    ).toBe("ad-4");
  });
});

describe("buildExportPlan", () => {
  const episodePath = "/tmp/episode.mp4";

  it("returns error when episode duration is zero", () => {
    const r = buildExportPlan([], episodePath, 0, catalog, PERF);
    expect(r.errors).toContain("Episode duration unknown");
    expect(r.segments).toHaveLength(0);
  });

  it("builds episode + ad + episode segments in order", () => {
    const markers: AdMarker[] = [
      { id: "m1", startTime: 30, mode: "static", adIds: ["ad-2"] },
      { id: "m2", startTime: 60, mode: "ab", adIds: ["ad-1", "ad-4"] },
    ];
    const { segments, totalDurationSec, errors } = buildExportPlan(
      markers,
      episodePath,
      120,
      catalog,
      PERF
    );

    expect(errors).toHaveLength(0);
    expect(segments).toHaveLength(5);
    expect(segments[0]).toMatchObject({
      type: "episode",
      startSec: 0,
      endSec: 30,
      file: episodePath,
    });
    expect(segments[1]).toMatchObject({ type: "ad", adId: "ad-2", durationSec: 12 });
    expect(segments[2]).toMatchObject({
      type: "episode",
      startSec: 30,
      endSec: 60,
    });
    expect(segments[3]).toMatchObject({ type: "ad", adId: "ad-4", durationSec: 15 });
    expect(segments[4]).toMatchObject({
      type: "episode",
      startSec: 60,
      endSec: 120,
    });
    expect(totalDurationSec).toBe(30 + 12 + 30 + 15 + 60);
  });

  it("skips markers without ads", () => {
    const markers: AdMarker[] = [
      { id: "m1", startTime: 10, mode: "static", adIds: [] },
      { id: "m2", startTime: 20, mode: "static", adIds: ["ad-1"] },
    ];
    const { segments } = buildExportPlan(markers, episodePath, 60, catalog, PERF);
    const ads = segments.filter((s) => s.type === "ad");
    expect(ads).toHaveLength(1);
    expect(ads[0].type === "ad" && ads[0].adId).toBe("ad-1");
  });
});
