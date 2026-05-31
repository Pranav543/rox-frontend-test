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

export async function POST() {
  if (!(await isFfmpegAvailable())) {
    return NextResponse.json(
      {
        error:
          "ffmpeg is not installed. Install ffmpeg to export MP4 (e.g. brew install ffmpeg).",
      },
      { status: 503 }
    );
  }

  const episodeRel = getEpisodeFilename();
  const episodePath = safeMediaPath(episodeRel);
  if (!episodePath) {
    return NextResponse.json({ error: "Episode video file not found" }, { status: 400 });
  }

  const markers = listMarkers().filter((m) => m.adIds?.length);
  if (markers.length === 0) {
    return NextResponse.json(
      { error: "Add at least one ad marker with ads assigned before exporting" },
      { status: 400 }
    );
  }

  let episodeDuration: number;
  try {
    episodeDuration = await probeMediaDurationSec(episodePath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not read episode duration";
    return NextResponse.json({ error: msg }, { status: 400 });
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
    return NextResponse.json({ error: "Nothing to export" }, { status: 400 });
  }

  const resolvedSegments = await resolveAdClipDurations(segments);
  const exportDurationSec = totalDurationFromSegments(resolvedSegments);

  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const filename = `vidpod-export-${Date.now()}.mp4`;
  const outputPath = path.join(EXPORT_DIR, filename);

  try {
    await renderExportToFile(resolvedSegments, outputPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    filename,
    downloadUrl: `/api/export/${filename}`,
    durationSec: exportDurationSec,
    segmentCount: resolvedSegments.length,
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
