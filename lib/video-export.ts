import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ExportSegment } from "./export-plan";
import { runFfmpeg } from "./ffmpeg";

export const EXPORT_DIR = path.join(process.cwd(), "data", "exports");

const ENCODE_ARGS = [
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
  "-movflags",
  "+faststart",
];

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

async function extractEpisodePart(
  input: string,
  startSec: number,
  durationSec: number,
  output: string
) {
  await runFfmpeg([
    "-y",
    "-ss",
    String(startSec),
    "-i",
    input,
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
    ...ENCODE_ARGS,
    output,
  ]);
}

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
      "-c",
      "copy",
      output,
    ]);
  } catch {
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      ...ENCODE_ARGS,
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
  outputPath: string
): Promise<void> {
  if (segments.length === 0) {
    throw new Error("Nothing to export");
  }

  ensureExportDir();
  const tmpDir = path.join(EXPORT_DIR, `tmp-${randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const partPaths: string[] = [];

  try {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const part = path.join(tmpDir, `part-${String(i).padStart(3, "0")}.mp4`);

      if (seg.type === "episode") {
        const dur = seg.endSec - seg.startSec;
        if (dur <= 0.05) continue;
        await extractEpisodePart(seg.file, seg.startSec, dur, part);
      } else {
        if (seg.durationSec <= 0.05) continue;
        await extractAdPart(seg.file, seg.durationSec, part);
      }

      if (fs.existsSync(part)) {
        partPaths.push(part);
      }
    }

    if (partPaths.length === 0) {
      throw new Error("No video segments were generated");
    }

    await concatParts(partPaths, outputPath);
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
