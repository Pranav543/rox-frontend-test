import type { AdPerformance } from "./marker-config";
import { pickAutoAdPreview, pickBestAbAd } from "./marker-config";
import { safeMediaPath } from "./media";
import { adDurationFor } from "./playback";
import type { Ad, AdMarker } from "./types";

export type EpisodeExportSegment = {
  type: "episode";
  file: string;
  startSec: number;
  endSec: number;
};

export type AdExportSegment = {
  type: "ad";
  file: string;
  durationSec: number;
  adId: string;
  markerId: string;
};

export type ExportSegment = EpisodeExportSegment | AdExportSegment;

export function resolveAdForExport(
  marker: AdMarker,
  performance: Record<string, AdPerformance>
): string | null {
  const pool = marker.adIds ?? [];
  if (pool.length === 0) return null;

  switch (marker.mode) {
    case "static":
      return pool[0];
    case "auto":
      return pickAutoAdPreview(marker.id, pool);
    case "ab":
      return pickBestAbAd(pool, performance);
    default:
      return pool[0];
  }
}

export type ExportPlanResult = {
  segments: ExportSegment[];
  totalDurationSec: number;
  errors: string[];
};

/** Build ordered clip list for ffmpeg concat (episode slices + ads). */
export function buildExportPlan(
  markers: AdMarker[],
  episodePath: string,
  episodeDuration: number,
  catalog: Ad[],
  performance: Record<string, AdPerformance>
): ExportPlanResult {
  const errors: string[] = [];
  const segments: ExportSegment[] = [];

  if (episodeDuration <= 0) {
    return { segments: [], totalDurationSec: 0, errors: ["Episode duration unknown"] };
  }

  const sorted = [...markers]
    .filter((m) => m.adIds?.length)
    .sort((a, b) => a.startTime - b.startTime);

  let episodeCursor = 0;
  let totalDurationSec = 0;

  const pushEpisode = (from: number, to: number) => {
    if (to <= from) return;
    segments.push({
      type: "episode",
      file: episodePath,
      startSec: from,
      endSec: to,
    });
    totalDurationSec += to - from;
  };

  for (const marker of sorted) {
    const start = Math.min(Math.max(marker.startTime, 0), episodeDuration);
    if (start > episodeCursor) {
      pushEpisode(episodeCursor, start);
      episodeCursor = start;
    }

    const adId = resolveAdForExport(marker, performance);
    if (!adId) {
      errors.push(`Marker ${marker.id}: no ad selected`);
      continue;
    }

    const ad = catalog.find((a) => a.id === adId);
    if (!ad) {
      errors.push(`Marker ${marker.id}: unknown ad ${adId}`);
      continue;
    }

    const adPath = safeMediaPath(ad.filename);
    if (!adPath) {
      errors.push(`Marker ${marker.id}: missing file ${ad.filename}`);
      continue;
    }

    const len = adDurationFor(catalog, adId);
    segments.push({
      type: "ad",
      file: adPath,
      durationSec: len,
      adId,
      markerId: marker.id,
    });
    totalDurationSec += len;
  }

  if (episodeCursor < episodeDuration) {
    pushEpisode(episodeCursor, episodeDuration);
  }

  return { segments, totalDurationSec, errors };
}

export function totalDurationFromSegments(segments: ExportSegment[]): number {
  return segments.reduce((sum, seg) => {
    if (seg.type === "episode") return sum + (seg.endSec - seg.startSec);
    return sum + seg.durationSec;
  }, 0);
}
