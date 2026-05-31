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

const vitest = spawnSync("npm", ["test", "--", "lib/export-plan.test.ts"], {
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
const body = await postRes.json();
if (!postRes.ok) {
  fail(`POST /api/export → ${postRes.status}: ${body.error ?? JSON.stringify(body)}`);
}

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
