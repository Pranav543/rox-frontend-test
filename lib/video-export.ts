import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ExportProgressUpdate } from "./export-progress";
import {
  computeExportProgress,
  countExportSteps,
  segmentProgressLabel,
} from "./export-progress";
import type { ExportSegment } from "./export-plan";
import { runFfmpeg } from "./ffmpeg";

export type { ExportProgressUpdate } from "./export-progress";

export type ExportProgressCallback = (update: ExportProgressUpdate) => void;

export const EXPORT_DIR = path.join(process.cwd(), "data", "exports");

const MAP_AV = ["-map", "0:v:0", "-map", "0:a:0?"];

const ENCODE_ARGS = [
  ...MAP_AV,
  "-c:v",
  "libx264",
  "-preset",
  "fast",
  "-crf",
  "23",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-ar",
  "44100",
  "-ac",
  "2",
  "-avoid_negative_ts",
  "make_zero",
  "-movflags",
  "+faststart",
];

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

/** Input-first seek so episode audio does not bleed from before the cut point. */
async function extractEpisodePart(
  input: string,
  startSec: number,
  durationSec: number,
  output: string
) {
  await runFfmpeg([
    "-y",
    "-i",
    input,
    "-ss",
    String(startSec),
    "-t",
    String(durationSec),
    ...ENCODE_ARGS,
    output,
  ]);
}

async function extractAdPart(
  input: string,
  durationSec: number,
  output: string
) {
  await runFfmpeg([
    "-y",
    "-i",
    input,
    "-t",
    String(durationSec),
    "-shortest",
    ...ENCODE_ARGS,
    output,
  ]);
}

/** Re-encode concat so segment timestamps/audio stay in sync (no episode bleed under ads). */
async function concatParts(partPaths: string[], output: string) {
  const listPath = path.join(path.dirname(output), `concat-${randomUUID()}.txt`);
  const listBody = partPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(listPath, listBody);

  try {
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      ...MAP_AV,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-reset_timestamps",
      "1",
      "-movflags",
      "+faststart",
      output,
    ]);
  } finally {
    try {
      fs.unlinkSync(listPath);
    } catch {
      /* ok */
    }
  }
}

export async function renderExportToFile(
  segments: ExportSegment[],
  outputPath: string,
  onProgress?: ExportProgressCallback
): Promise<void> {
  if (segments.length === 0) {
    throw new Error("Nothing to export");
  }

  const totalSteps = countExportSteps(segments);
  let completedSteps = 0;
  const emit = (stage: string) => {
    onProgress?.(computeExportProgress(completedSteps, totalSteps, stage));
  };

  emit("Preparing export…");

  ensureExportDir();
  const tmpDir = path.join(EXPORT_DIR, `tmp-${randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const partPaths: string[] = [];
  let clipIndex = 0;
  const clipTotal = totalSteps - 1;

  try {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const part = path.join(tmpDir, `part-${String(i).padStart(3, "0")}.mp4`);

      if (seg.type === "episode") {
        const dur = seg.endSec - seg.startSec;
        if (dur <= 0.05) continue;
        clipIndex++;
        emit(segmentProgressLabel(seg, clipIndex, clipTotal));
        await extractEpisodePart(seg.file, seg.startSec, dur, part);
      } else {
        if (seg.durationSec <= 0.05) continue;
        clipIndex++;
        emit(segmentProgressLabel(seg, clipIndex, clipTotal));
        await extractAdPart(seg.file, seg.durationSec, part);
      }

      if (fs.existsSync(part)) {
        partPaths.push(part);
        completedSteps++;
        emit(segmentProgressLabel(seg, clipIndex, clipTotal));
      }
    }

    if (partPaths.length === 0) {
      throw new Error("No video segments were generated");
    }

    completedSteps = Math.min(completedSteps, totalSteps - 1);
    emit("Merging segments…");
    await concatParts(partPaths, outputPath);
    completedSteps = totalSteps;
    onProgress?.(computeExportProgress(totalSteps, totalSteps, "Export complete"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function safeExportFilename(name: string): string | null {
  const base = path.basename(name);
  if (!/^vidpod-export-\d+\.mp4$/.test(base)) return null;
  const full = path.join(EXPORT_DIR, base);
  if (!full.startsWith(EXPORT_DIR)) return null;
  if (!fs.existsSync(full)) return null;
  return full;
}
