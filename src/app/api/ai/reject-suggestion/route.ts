import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getAnalysis, upsertAnalysis } from "@/lib/ai/ai-analysis-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { analysisId: string };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.analysisId) {
      return NextResponse.json({ error: "analysisId requis." }, { status: 400 });
    }
    const analysis = await getAnalysis(body.analysisId);
    if (!analysis) {
      return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 });
    }
    const updated = await upsertAnalysis({ ...analysis, id: analysis.id, status: "rejected" });
    return NextResponse.json({ analysis: updated });
  } catch (error) {
    return jsonError("Rejet impossible", error);
  }
}
