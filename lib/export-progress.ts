import type { ExportSegment } from "./export-plan";

export type ExportProgressUpdate = {
  percent: number;
  stage: string;
  step: number;
  totalSteps: number;
};

/** Billable ffmpeg steps: one per segment clip + final concat. */
export function countExportSteps(segments: ExportSegment[]): number {
  let clips = 0;
  for (const seg of segments) {
    if (seg.type === "episode") {
      if (seg.endSec - seg.startSec > 0.05) clips++;
    } else if (seg.durationSec > 0.05) {
      clips++;
    }
  }
  return Math.max(clips + 1, 1);
}

export function segmentProgressLabel(
  seg: ExportSegment,
  index: number,
  total: number
): string {
  if (seg.type === "episode") {
    return `Encoding episode part ${index} of ${total}`;
  }
  return `Encoding ad ${seg.adId} (${index} of ${total})`;
}

export function computeExportProgress(
  completedSteps: number,
  totalSteps: number,
  stage: string
): ExportProgressUpdate {
  const total = Math.max(totalSteps, 1);
  const clamped = Math.min(Math.max(completedSteps, 0), total);
  const percent =
    clamped >= total
      ? 100
      : Math.min(99, Math.round((clamped / total) * 100));
  return {
    percent,
    stage,
    step: clamped,
    totalSteps: total,
  };
}
