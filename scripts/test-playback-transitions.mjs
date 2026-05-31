/**
 * Simulates ad-break completion logic (no browser).
 * Run: node scripts/test-playback-transitions.mjs
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

// Inline minimal timeline build matching lib/playback.ts
function buildTimeline(markers, episodeDuration, catalog) {
  const sorted = [...markers].sort((a, b) => a.startTime - b.startTime);
  const segments = [];
  let timelineCursor = 0;
  let episodeCursor = 0;

  for (const marker of sorted) {
    const start = Math.min(Math.max(marker.startTime, 0), episodeDuration);
    if (start > episodeCursor) {
      const len = start - episodeCursor;
      segments.push({
        type: "episode",
        episodeStart: episodeCursor,
        episodeEnd: start,
        timelineStart: timelineCursor,
        timelineEnd: timelineCursor + len,
      });
      timelineCursor += len;
      episodeCursor = start;
    }
    if (!marker.adIds?.length) continue;
    const adId = marker.adIds[0];
    const ad = catalog.find((a) => a.id === adId);
    const len = ad?.duration ?? 15;
    segments.push({
      type: "ad",
      markerId: marker.id,
      adId,
      timelineStart: timelineCursor,
      timelineEnd: timelineCursor + len,
    });
    timelineCursor += len;
  }

  if (episodeCursor < episodeDuration) {
    segments.push({
      type: "episode",
      episodeStart: episodeCursor,
      episodeEnd: episodeDuration,
      timelineStart: timelineCursor,
      timelineEnd: timelineCursor + (episodeDuration - episodeCursor),
    });
  }

  return segments;
}

function episodeSegmentAfterAd(adSeg, segments) {
  const idx = segments.findIndex(
    (s) => s.type === "ad" && s.markerId === adSeg.markerId
  );
  if (idx < 0 || idx >= segments.length - 1) return null;
  const next = segments[idx + 1];
  return next.type === "episode" ? next : null;
}

function isAdVideoFinished(videoCurrentTime, videoDuration) {
  if (!Number.isFinite(videoDuration) || videoDuration <= 0) return false;
  return videoCurrentTime >= videoDuration - 0.1;
}

const catalog = JSON.parse(
  readFileSync(join(root, "data/ads.json"), "utf8")
);
const markers = [
  { id: "m1", startTime: 30, mode: "static", adIds: ["ad-1"] },
];
const segments = buildTimeline(markers, 120, catalog);
const adSeg = segments.find((s) => s.type === "ad");

const realAdDuration = 5.758549;
const timelineAtEnd = adSeg.timelineStart + realAdDuration;

assert(
  isAdVideoFinished(realAdDuration, realAdDuration),
  "should finish when real video ends (~5.76s)"
);

const resume = episodeSegmentAfterAd(adSeg, segments);
assert(resume?.episodeStart === 30, "resume episode at marker");
assert(resume?.timelineStart === adSeg.timelineEnd, "timeline at post-ad block");

assert(!isAdVideoFinished(2, realAdDuration), "should not finish mid-ad");

console.log("ok: ad finishes on real video duration");
console.log("ok: resume targets episode time 30 / timeline", resume.timelineStart);
function segmentAtTimelineTime(t, segments) {
  const clamped = Math.max(0, Math.min(t, segments[segments.length - 1].timelineEnd));
  for (const seg of segments) {
    if (clamped >= seg.timelineStart && clamped < seg.timelineEnd) return seg;
  }
  return segments[segments.length - 1];
}

const segBefore = segmentAtTimelineTime(10, segments);
const segAfter = segmentAtTimelineTime(50, segments);
assert(segBefore.type === "episode", "click before ad seeks episode");
assert(segAfter.type === "episode", "click after ad seeks episode, not ad loop");

console.log("ok: timeline click before ad → episode segment");
console.log("ok: timeline click after ad → episode segment");

console.log("\nAll playback transition checks passed");
