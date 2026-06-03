import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const analyses = await listAnalyses();
    const financial = analyses
      .filter((analysis) => analysis.financialImpact.length > 0)
      .map((analysis) => ({
        analysisId: analysis.id,
        documentId: analysis.documentId,
        kind: analysis.detectedDocumentKind,
        urgency: analysis.urgency,
        confidence: analysis.confidence,
        status: analysis.status,
        summary: analysis.summary,
        financialImpact: analysis.financialImpact,
        suggestedCorrespondentName: analysis.suggestedCorrespondentName,
      }));
    return NextResponse.json({ items: financial });
  } catch (error) {
    return jsonError("Impossible de lister les documents financiers", error);
  }
}
