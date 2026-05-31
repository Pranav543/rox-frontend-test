import { readAdPerformance } from "@/lib/ad-performance-server";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(readAdPerformance());
}
