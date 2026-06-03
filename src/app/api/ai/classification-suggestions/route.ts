import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ready = await listAnalyses({ status: "ready-to-validate" });
    return NextResponse.json({ suggestions: ready });
  } catch (error) {
    return jsonError("Impossible de lister les suggestions", error);
  }
}
