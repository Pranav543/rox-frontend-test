import { safeMediaPath } from "@/lib/media";
import fs from "fs";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, { params }: Params) {
  const { path: segments } = await params;
  const relativePath = segments.map(decodeURIComponent).join("/");
  const filePath = safeMediaPath(relativePath);
  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);
  const body = new ReadableStream({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      stream.on("data", (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
          stream.destroy();
        }
      });
      stream.on("end", close);
      stream.on("error", (err) => {
        if (!closed) controller.error(err);
        stream.destroy();
      });
    },
    cancel() {
      stream.destroy();
    },
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
    },
  });
}
