import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const analyses = await listAnalyses();
    const items = analyses.flatMap((analysis) =>
      analysis.recommendedActions.map((action) => ({
        ...action,
        analysisId: analysis.id,
        documentId: analysis.documentId,
        confidence: analysis.confidence,
        urgency: analysis.urgency,
        analysisStatus: analysis.status,
      })),
    );
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible de récupérer les actions recommandées", error);
  }
}
