import fs from "fs";
import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const PODCAST_DIR = path.join(DATA_DIR, "podcast");
export const ADS_DIR = path.join(DATA_DIR, "ads");
export const DEFAULT_EPISODE = "podcast/main-video.mp4";

const ALLOWED = new Set([".mp4", ".webm", ".mov"]);

function ensureDirs() {
  for (const dir of [DATA_DIR, PODCAST_DIR, ADS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

/** Relative media key, e.g. `podcast/main-video.mp4` or `ads/sample-ad-1.mp4` */
export function safeMediaPath(relativePath: string): string | null {
  ensureDirs();
  const normalized = path.normalize(relativePath).replace(/\\/g, "/");
  if (normalized.includes("..")) return null;

  const parts = normalized.split("/");
  if (parts.length !== 2) return null;

  const [folder, file] = parts;
  if (folder !== "podcast" && folder !== "ads") return null;

  const base = path.basename(file);
  if (base !== file || base.includes("..")) return null;
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED.has(ext)) return null;

  const root = folder === "podcast" ? PODCAST_DIR : ADS_DIR;
  const full = path.join(root, base);
  if (!full.startsWith(root)) return null;
  if (!fs.existsSync(full)) return null;
  return full;
}

export function mediaUrl(relativePath: string): string {
  const encoded = relativePath
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
  return `/api/media/${encoded}`;
}

export function listPodcastVideos(): { filename: string; name: string }[] {
  ensureDirs();
  return fs
    .readdirSync(PODCAST_DIR)
    .filter((f) => ALLOWED.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => ({
      filename: `podcast/${f}`,
      name: f.replace(/\.[^.]+$/, "").replace(/-/g, " "),
    }));
}

export function listAdVideoFiles(): string[] {
  ensureDirs();
  return fs
    .readdirSync(ADS_DIR)
    .filter((f) => ALLOWED.has(path.extname(f).toLowerCase()))
    .sort();
}

export function savePodcastUpload(originalName: string, bytes: Buffer): string {
  ensureDirs();
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = base.endsWith(".mp4") ? base : `${base}.mp4`;
  const rel = `podcast/${filename}`;
  fs.writeFileSync(path.join(PODCAST_DIR, filename), bytes);
  return rel;
}
