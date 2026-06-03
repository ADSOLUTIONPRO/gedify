import { NextResponse } from "next/server";
import { getBatchState } from "@/lib/ai/batch-status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ batch: getBatchState() });
}
