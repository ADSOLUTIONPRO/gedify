import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const analyses = await listAnalyses();
    const items = analyses
      .filter((analysis) => analysis.financialImpact.length > 0)
      .flatMap((analysis) =>
        analysis.financialImpact.map((entry) => ({
          ...entry,
          analysisId: analysis.id,
          documentId: analysis.documentId,
          status: analysis.status,
        })),
      );
    return NextResponse.json({ items });
  } catch (error) {
    return jsonError("Impossible d'extraire les données financières", error);
  }
}
