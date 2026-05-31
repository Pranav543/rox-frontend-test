import { describe, expect, it } from "vitest";
import { isAdMediaSrc, isEpisodeMediaSrc } from "./video-src";

describe("video-src", () => {
  const episode = "/api/media/podcast%2Fmain-video.mp4";

  it("detects episode paths", () => {
    expect(
      isEpisodeMediaSrc(
        "http://localhost:3000/api/media/podcast%2Fmain-video.mp4",
        episode
      )
    ).toBe(true);
  });

  it("does not treat ad paths as episode", () => {
    const ad = "http://localhost:3000/api/media/ads%2Fsample-ad-1.mp4";
    expect(isEpisodeMediaSrc(ad, episode)).toBe(false);
    expect(isAdMediaSrc(ad)).toBe(true);
  });
});
