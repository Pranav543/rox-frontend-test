import { getAdsCatalog } from "@/lib/ads-server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json(getAdsCatalog());
  } catch (err) {
    console.error("[api/ads] GET failed:", err);
    return NextResponse.json(
      { error: "Failed to load ads catalog" },
      { status: 500 }
    );
  }
}
