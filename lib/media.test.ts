import { describe, expect, it } from "vitest";
import { safeMediaPath, mediaUrl } from "./media";
import path from "path";

describe("media", () => {
  it("rejects path traversal", () => {
    expect(safeMediaPath("../package.json")).toBeNull();
    expect(safeMediaPath("podcast/../package.json")).toBeNull();
  });

  it("finds podcast main-video", () => {
    const p = safeMediaPath("podcast/main-video.mp4");
    expect(p).not.toBeNull();
    expect(p).toBe(path.join(process.cwd(), "data", "podcast", "main-video.mp4"));
  });

  it("finds ads sample video", () => {
    const p = safeMediaPath("ads/sample-ad-1.mp4");
    expect(p).not.toBeNull();
  });

  it("builds media API url with folder", () => {
    expect(mediaUrl("podcast/main-video.mp4")).toBe(
      "/api/media/podcast/main-video.mp4"
    );
  });
});
