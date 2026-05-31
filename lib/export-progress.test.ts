import { describe, expect, it } from "vitest";
import {
  computeExportProgress,
  countExportSteps,
} from "./export-progress";
import type { ExportSegment } from "./export-plan";

describe("countExportSteps", () => {
  it("counts clips plus concat", () => {
    const segments: ExportSegment[] = [
      { type: "episode", file: "/e.mp4", startSec: 0, endSec: 10 },
      { type: "ad", file: "/a.mp4", durationSec: 5, adId: "ad-1", markerId: "m1" },
      { type: "episode", file: "/e.mp4", startSec: 10, endSec: 20 },
    ];
    expect(countExportSteps(segments)).toBe(4);
  });

  it("skips zero-length segments", () => {
    const segments: ExportSegment[] = [
      { type: "episode", file: "/e.mp4", startSec: 5, endSec: 5 },
      { type: "ad", file: "/a.mp4", durationSec: 0, adId: "ad-1", markerId: "m1" },
    ];
    expect(countExportSteps(segments)).toBe(1);
  });
});

describe("computeExportProgress", () => {
  it("returns 0 at start", () => {
    const p = computeExportProgress(0, 5, "Preparing");
    expect(p.percent).toBe(0);
    expect(p.stage).toBe("Preparing");
    expect(p.step).toBe(0);
    expect(p.totalSteps).toBe(5);
  });

  it("caps below 100 until finished", () => {
    const p = computeExportProgress(3, 5, "Encoding");
    expect(p.percent).toBe(60);
    expect(p.percent).toBeLessThan(100);
  });

  it("returns 100 when all steps complete", () => {
    const p = computeExportProgress(5, 5, "Done");
    expect(p.percent).toBe(100);
  });
});
