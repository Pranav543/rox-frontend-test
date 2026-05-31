import { readAdPerformance } from "@/lib/ad-performance-server";
import { getAdsCatalog } from "@/lib/ads-server";
import { getEpisodeFilename, listMarkers } from "@/lib/db";
import { buildExportPlan, totalDurationFromSegments } from "@/lib/export-plan";
import type { ExportSegment } from "@/lib/export-plan";
import { probeMediaDurationSec, isFfmpegAvailable } from "@/lib/ffmpeg";
import { safeMediaPath } from "@/lib/media";
import { EXPORT_DIR, renderExportToFile } from "@/lib/video-export";
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST() {
  if (!(await isFfmpegAvailable())) {
    return jsonError(
      "ffmpeg is not installed. Install ffmpeg to export MP4 (e.g. brew install ffmpeg).",
      503
    );
  }

  const episodeRel = getEpisodeFilename();
  const episodePath = safeMediaPath(episodeRel);
  if (!episodePath) {
    return jsonError("Episode video file not found", 400);
  }

  const markers = listMarkers().filter((m) => m.adIds?.length);
  if (markers.length === 0) {
    return jsonError(
      "Add at least one ad marker with ads assigned before exporting",
      400
    );
  }

  let episodeDuration: number;
  try {
    episodeDuration = await probeMediaDurationSec(episodePath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not read episode duration";
    return jsonError(msg, 400);
  }

  const catalog = getAdsCatalog();
  const performance = readAdPerformance();
  const { segments, errors } = buildExportPlan(
    markers,
    episodePath,
    episodeDuration,
    catalog,
    performance
  );

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; "), errors }, { status: 400 });
  }

  if (segments.length === 0) {
    return jsonError("Nothing to export", 400);
  }

  const resolvedSegments = await resolveAdClipDurations(segments);
  const exportDurationSec = totalDurationFromSegments(resolvedSegments);

  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const filename = `vidpod-export-${Date.now()}.mp4`;
  const outputPath = path.join(EXPORT_DIR, filename);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: object) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        await renderExportToFile(resolvedSegments, outputPath, (update) => {
          emit({
            type: "progress",
            percent: update.percent,
            stage: update.stage,
            step: update.step,
            totalSteps: update.totalSteps,
          });
        });

        emit({
          type: "done",
          filename,
          downloadUrl: `/api/export/${filename}`,
          durationSec: exportDurationSec,
          segmentCount: resolvedSegments.length,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Export failed";
        emit({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}

async function resolveAdClipDurations(
  segments: ExportSegment[]
): Promise<ExportSegment[]> {
  return Promise.all(
    segments.map(async (seg) => {
      if (seg.type !== "ad") return seg;
      try {
        const fileSec = await probeMediaDurationSec(seg.file);
        return {
          ...seg,
          durationSec: Math.min(seg.durationSec, fileSec),
        };
      } catch {
        return seg;
      }
    })
  );
}

export async function GET() {
  const available = await isFfmpegAvailable();
  return NextResponse.json({ ffmpegAvailable: available });
}
