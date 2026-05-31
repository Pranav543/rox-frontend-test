import { safeExportFilename } from "@/lib/video-export";
import fs from "fs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ filename: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { filename } = await params;
  const filePath = safeExportFilename(filename);
  if (!filePath) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
