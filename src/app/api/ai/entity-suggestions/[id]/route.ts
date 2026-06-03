import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getCorrespondents, getDocumentTypes, getTags } from "@/lib/paperless";
import { getLatestAnalysisForDocument } from "@/lib/ai/ai-analysis-store";
import { buildAllEntitySuggestions } from "@/lib/ai/entity-suggestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Auth is handled by middleware — same pattern as /api/ai/analyze-document.
// A second requireAuth() layer can fail in Next.js App Router route handlers
// (req.cookies vs cookies() from next/headers divergence).
export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const documentId = Number(id);

    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ error: "documentId invalide." }, { status: 400 });
    }

    const [analysis, correspondentsData, typesData, tagsData] = await Promise.all([
      getLatestAnalysisForDocument(documentId),
      getCorrespondents(),
      getDocumentTypes(),
      getTags(),
    ]);

    if (!analysis) {
      return NextResponse.json({ error: "Aucune analyse disponible" }, { status: 404 });
    }

    const suggestions = buildAllEntitySuggestions(
      analysis,
      correspondentsData.results ?? [],
      typesData.results ?? [],
      tagsData.results ?? [],
    );

    return NextResponse.json(suggestions);
  } catch (error) {
    return jsonError("Impossible de calculer les suggestions d'entités", error);
  }
}
