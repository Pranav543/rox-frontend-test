import { deleteMarker, getMarker, updateMarker } from "@/lib/db";
import type { UpdateMarkerBody } from "@/lib/types";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const existing = getMarker(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as UpdateMarkerBody;
  const patch: Parameters<typeof updateMarker>[1] = {};

  if (body.startTime !== undefined) {
    const t = Number(body.startTime);
    if (!Number.isFinite(t) || t < 0) {
      return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
    }
    patch.startTime = t;
  }
  if (body.mode !== undefined) patch.mode = body.mode;
  if (body.adIds !== undefined) patch.adIds = body.adIds.filter(Boolean);

  const marker = updateMarker(id, patch);
  return NextResponse.json(marker);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const ok = deleteMarker(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
