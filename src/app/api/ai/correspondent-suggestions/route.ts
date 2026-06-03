import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getLatestAnalysisForDocument } from "@/lib/ai/ai-analysis-store";
import { buildCorrespondentSuggestion } from "@/lib/ai/correspondent-suggestions";
import { getCorrespondents } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const documentId = Number(request.nextUrl.searchParams.get("documentId"));
    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ error: "documentId requis." }, { status: 400 });
    }
    const analysis = await getLatestAnalysisForDocument(documentId);
    if (!analysis) {
      return NextResponse.json({ suggestion: null, message: "Aucune analyse pour ce document." });
    }
    const correspondents = (await getCorrespondents()).results ?? [];
    return NextResponse.json({ suggestion: buildCorrespondentSuggestion(analysis, correspondents) });
  } catch (error) {
    return jsonError("Suggestions correspondant impossibles", error);
  }
}
