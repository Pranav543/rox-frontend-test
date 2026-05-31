import { execFile } from "child_process";
import fs from "fs";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const FFMPEG_CANDIDATES = [
  "ffmpeg",
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
];

const FFPROBE_CANDIDATES = [
  "ffprobe",
  "/opt/homebrew/bin/ffprobe",
  "/usr/local/bin/ffprobe",
];

let ffmpegPath: string | null | undefined;
let ffprobePath: string | null | undefined;

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveBinary(
  candidates: string[],
  cache: string | null | undefined
): Promise<string | null> {
  if (cache !== undefined) return cache;

  for (const candidate of candidates) {
    if (candidate.includes("/")) {
      if (await fileExists(candidate)) return candidate;
      continue;
    }
    try {
      const { stdout } = await execFileAsync("which", [candidate], {
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ""}`,
        },
      });
      const p = stdout.trim().split("\n")[0];
      if (p) return p;
    } catch {
      /* try next */
    }
    try {
      await execFileAsync(candidate, ["-version"], {
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ""}`,
        },
      });
      return candidate;
    } catch {
      /* not on PATH */
    }
  }

  return null;
}

export async function getFfmpegPath(): Promise<string | null> {
  ffmpegPath = await resolveBinary(FFMPEG_CANDIDATES, ffmpegPath);
  return ffmpegPath;
}

export async function getFfprobePath(): Promise<string | null> {
  ffprobePath = await resolveBinary(FFPROBE_CANDIDATES, ffprobePath);
  return ffprobePath;
}

export async function isFfmpegAvailable(): Promise<boolean> {
  return (await getFfmpegPath()) !== null;
}

export async function probeMediaDurationSec(filePath: string): Promise<number> {
  const ffprobe = await getFfprobePath();
  if (!ffprobe) throw new Error("ffprobe not found");

  const { stdout } = await execFileAsync(
    ffprobe,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    { maxBuffer: 1024 * 1024 }
  );

  const sec = parseFloat(stdout.trim());
  if (!Number.isFinite(sec) || sec <= 0) {
    throw new Error(`Could not read duration for ${filePath}`);
  }
  return sec;
}

export async function runFfmpeg(args: string[]): Promise<void> {
  const ffmpeg = await getFfmpegPath();
  if (!ffmpeg) throw new Error("ffmpeg not found");

  try {
    await execFileAsync(ffmpeg, args, {
      maxBuffer: 1024 * 1024 * 8,
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ""}`,
      },
    });
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    const detail = e.stderr?.trim() || e.message || "ffmpeg failed";
    throw new Error(detail);
  }
}
