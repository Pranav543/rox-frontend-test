import { describe, expect, it } from "vitest";
import {
  pickBestAbAd,
  pickRandomFromPool,
  resolveAdForMarker,
} from "./marker-config";

const PERF = {
  "ad-1": { ctr: 0.02, completions: 1, label: "A1" },
  "ad-4": { ctr: 0.06, completions: 1, label: "A4" },
};

describe("resolveAdForMarker", () => {
  it("static uses user-selected ad only", () => {
    const m = { id: "1", startTime: 0, mode: "static" as const, adIds: ["ad-3"] };
    expect(resolveAdForMarker(m)).toBe("ad-3");
  });

  it("ab picks highest CTR from selected pool using live performance", () => {
    const m = {
      id: "1",
      startTime: 0,
      mode: "ab" as const,
      adIds: ["ad-1", "ad-4"],
    };
    expect(resolveAdForMarker(m, { performance: PERF })).toBe("ad-4");
  });

  it("auto random respects selected pool only", () => {
    const pool = ["ad-2", "ad-3"];
    expect(pool).toContain(pickRandomFromPool(pool, () => 0));
    expect(pool).toContain(pickRandomFromPool(pool, () => 0.99));
  });

  it("pickBestAbAd updates when performance changes", () => {
    const pool = ["ad-1", "ad-4"];
    expect(pickBestAbAd(pool, PERF)).toBe("ad-4");
    expect(pickBestAbAd(pool, { "ad-1": { ctr: 0.9, completions: 1, label: "A1" } })).toBe(
      "ad-1"
    );
  });
});
