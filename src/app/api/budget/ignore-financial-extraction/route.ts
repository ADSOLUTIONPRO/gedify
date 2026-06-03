import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getAnalysis } from "@/lib/ai/ai-analysis-store";
import { mapImpactToCandidate } from "@/lib/budget/financial-extraction-mapper";
import { createFinancialItem } from "@/lib/budget/financial-item-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { analysisId: string; impactIndex?: number };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.analysisId) {
      return NextResponse.json({ error: "analysisId requis." }, { status: 400 });
    }
    const analysis = await getAnalysis(body.analysisId);
    if (!analysis) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    const impact = analysis.financialImpact[body.impactIndex ?? 0];
    if (!impact) return NextResponse.json({ error: "Index invalide" }, { status: 404 });

    const candidate = mapImpactToCandidate(analysis, impact);
    const now = new Date().toISOString();
    const item = await createFinancialItem({
      ...candidate,
      status: "ignored",
      validationStatus: "ignored",
      ignoredAt: now,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Impossible d'ignorer la suggestion", error);
  }
}
