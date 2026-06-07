import { getEpisodeFilenameSafe, setEpisodeFilename } from "@/lib/db";
import {
  listPodcastVideos,
  mediaUrl,
  safeMediaPath,
  savePodcastUpload,
} from "@/lib/media";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const stored = getEpisodeFilenameSafe();
    const exists = safeMediaPath(stored) !== null;
    return NextResponse.json({
      filename: exists ? stored : null,
      url: exists ? mediaUrl(stored) : null,
      exists,
      videos: listPodcastVideos().map((v) => ({
        ...v,
        url: mediaUrl(v.filename),
        exists: safeMediaPath(v.filename) !== null,
      })),
    });
  } catch (err) {
    console.error("[api/episode] GET failed:", err);
    return NextResponse.json(
      { error: "Failed to load episode" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { filename?: string };
    const filename = body.filename;
    if (!filename || safeMediaPath(filename) === null) {
      return NextResponse.json({ error: "Invalid podcast video" }, { status: 400 });
    }
    if (!filename.startsWith("podcast/")) {
      return NextResponse.json({ error: "Must be a podcast/ video" }, { status: 400 });
    }
    setEpisodeFilename(filename);
    return NextResponse.json({
      filename,
      url: mediaUrl(filename),
      exists: true,
    });
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const name =
      file instanceof File && file.name ? file.name : `upload-${Date.now()}.mp4`;
    const rel = savePodcastUpload(
      name,
      Buffer.from(await file.arrayBuffer())
    );
    setEpisodeFilename(rel);
    return NextResponse.json({
      filename: rel,
      url: mediaUrl(rel),
      exists: true,
    });
  }

  return NextResponse.json({ error: "Select or upload a podcast video" }, { status: 400 });
}
