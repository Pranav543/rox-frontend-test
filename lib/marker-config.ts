import type { AdMode } from "./types";

export type AdPerformance = {
  ctr: number;
  completions: number;
  label: string;
};

/** A/B: pick ad with highest CTR from pool using live performance data */
export function pickBestAbAd(
  pool: string[],
  performance: Record<string, AdPerformance>
): string | null {
  if (pool.length === 0) return null;
  let best = pool[0];
  let bestCtr = -1;
  for (const id of pool) {
    const ctr = performance[id]?.ctr ?? 0;
    if (ctr > bestCtr) {
      bestCtr = ctr;
      best = id;
    }
  }
  return best;
}

/** Auto / random: pick from user-selected pool only */
export function pickRandomFromPool(
  pool: string[],
  random: () => number = Math.random
): string | null {
  if (pool.length === 0) return null;
  const i = Math.floor(random() * pool.length);
  return pool[i];
}

/** Stable preview for timeline UI (auto mode) */
export function pickAutoAdPreview(
  markerId: string,
  pool: string[]
): string | null {
  if (pool.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < markerId.length; i++) hash += markerId.charCodeAt(i);
  return pool[hash % pool.length];
}

export function resolveAdForMarker(
  marker: { id: string; mode: AdMode; adIds?: string[] },
  options?: {
    random?: () => number;
    forPlayback?: boolean;
    performance?: Record<string, AdPerformance>;
  }
): string | null {
  const pool = marker.adIds ?? [];
  if (pool.length === 0) return null;

  const performance = options?.performance ?? {};

  switch (marker.mode) {
    case "static":
      return pool[0];
    case "auto":
      if (options?.forPlayback) {
        return pickRandomFromPool(pool, options.random);
      }
      return pickAutoAdPreview(marker.id, pool);
    case "ab":
      return pickBestAbAd(pool, performance);
    default:
      return pool[0];
  }
}
