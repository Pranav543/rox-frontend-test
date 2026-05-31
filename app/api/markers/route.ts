import { createMarker, listMarkers } from "@/lib/db";
import type { AdMode, CreateMarkerBody } from "@/lib/types";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(listMarkers());
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateMarkerBody;
  const startTime = Number(body.startTime);
  if (!Number.isFinite(startTime) || startTime < 0) {
    return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
  }

  const mode = (body.mode ?? "static") as AdMode;
  const adIds = Array.isArray(body.adIds) ? body.adIds.filter(Boolean) : [];

  if (mode === "static" && adIds.length > 1) {
    return NextResponse.json({ error: "Static mode uses one ad" }, { status: 400 });
  }

  const id = typeof body.id === "string" && body.id.length > 0 ? body.id : randomUUID();
  const marker = createMarker(id, startTime, mode, adIds);
  return NextResponse.json(marker, { status: 201 });
}
