#!/usr/bin/env node
/**
 * Verifies MP4 export: plan unit logic (via vitest) + optional full ffmpeg stitch.
 * Usage: node scripts/test-export.mjs [--full]
 * Requires dev server for API: npm run dev (or BASE_URL=http://localhost:3000)
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const full = process.argv.includes("--full");

function fail(msg) {
  console.error("✗", msg);
  process.exit(1);
}

function ok(msg) {
  console.log("✓", msg);
}

const ff = spawnSync("which", ["ffmpeg"], { encoding: "utf8" });
if (ff.status !== 0) {
  console.warn("⚠ ffmpeg not found — skipping full export test");
} else {
  ok(`ffmpeg: ${ff.stdout.trim()}`);
}

const vitest = spawnSync("npm", ["test", "--", "lib/export-plan.test.ts", "lib/export-progress.test.ts", "lib/export-stream.test.ts"], {
  cwd: root,
  encoding: "utf8",
  stdio: "pipe",
});
if (vitest.status !== 0) {
  fail(`export-plan tests failed:\n${vitest.stdout}\n${vitest.stderr}`);
}
ok("export-plan unit tests");

let statusRes;
try {
  statusRes = await fetch(`${BASE}/api/export`);
} catch (e) {
  fail(`Cannot reach ${BASE}/api/export — start dev server (npm run dev). ${e.message}`);
}

if (!statusRes.ok) fail(`GET /api/export → ${statusRes.status}`);
const status = await statusRes.json();
if (!status.ffmpegAvailable) {
  console.warn("⚠ Server reports ffmpeg unavailable");
} else {
  ok("GET /api/export reports ffmpeg available");
}

if (!full) {
  console.log("\nRun with --full to POST export and verify output file (slow).");
  process.exit(0);
}

if (!status.ffmpegAvailable) {
  fail("ffmpeg required for --full");
}

const postRes = await fetch(`${BASE}/api/export`, { method: "POST" });
if (!postRes.ok) {
  const errBody = await postRes.json().catch(() => ({}));
  fail(`POST /api/export → ${postRes.status}: ${errBody.error ?? JSON.stringify(errBody)}`);
}

const contentType = postRes.headers.get("content-type") ?? "";
if (!contentType.includes("ndjson")) {
  fail(`POST /api/export expected application/x-ndjson, got ${contentType}`);
}

let body = null;
let lastProgress = null;
const reader = postRes.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type === "progress") {
      lastProgress = event;
    } else if (event.type === "done") {
      body = event;
    } else if (event.type === "error") {
      fail(`Export stream error: ${event.error}`);
    }
  }
}
if (buffer.trim()) {
  const event = JSON.parse(buffer);
  if (event.type === "done") body = event;
  if (event.type === "error") fail(`Export stream error: ${event.error}`);
}
if (!body?.downloadUrl) fail("Export stream missing done event");

if (!lastProgress || lastProgress.percent < 1) {
  fail("Export stream did not emit progress events");
}
ok(`Export progress events received (final ${lastProgress.percent}%)`);

ok(`POST export: ${body.filename} (${body.segmentCount} segments, ~${Math.round(body.durationSec)}s)`);

const dlRes = await fetch(`${BASE}${body.downloadUrl}`);
if (!dlRes.ok) fail(`Download → ${dlRes.status}`);

const outDir = path.join(root, "data", "exports");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `_test-${body.filename}`);
const buf = Buffer.from(await dlRes.arrayBuffer());
fs.writeFileSync(outPath, buf);

if (buf.length < 10_000) fail(`Export file too small: ${buf.length} bytes`);
ok(`Downloaded ${(buf.length / 1024 / 1024).toFixed(2)} MB → ${outPath}`);

const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    outPath,
  ],
  { encoding: "utf8" }
);
if (probe.status !== 0) fail("ffprobe failed on export");
const probed = parseFloat(probe.stdout.trim());
if (!Number.isFinite(probed) || probed < 1) fail(`Invalid export duration: ${probed}`);
ok(`ffprobe duration: ${probed.toFixed(1)}s (expected ~${body.durationSec})`);

console.log("\nExport test passed.");
