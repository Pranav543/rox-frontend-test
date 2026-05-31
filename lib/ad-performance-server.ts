import fs from "fs";
import path from "path";
import type { AdPerformance } from "./marker-config";

const PERF_PATH = path.join(process.cwd(), "data", "ad-performance.json");

/** Read performance JSON from disk on every call (live updates). */
export function readAdPerformance(): Record<string, AdPerformance> {
  try {
    if (!fs.existsSync(PERF_PATH)) return {};
    const raw = fs.readFileSync(PERF_PATH, "utf8");
    return JSON.parse(raw) as Record<string, AdPerformance>;
  } catch {
    return {};
  }
}
