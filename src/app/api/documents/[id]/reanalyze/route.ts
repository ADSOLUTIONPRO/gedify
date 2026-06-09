import "server-only";

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { runDocumentAnalysis } from "@/lib/ai/run-document-analysis";
import { withDocumentAnalysisLock } from "@/lib/ai/analysis-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Auth is handled by middleware (same as /api/ai/analyze-document).
export async function POST(request: NextRequest, { params }: Ctx) {
  const requestId = randomUUID();
  try {
    const { id } = await params;
    const docId = Number(id);
    const body = await request.json().catch(() => ({})) as { force?: boolean; allowWithoutOcr?: boolean };

    console.log(`[AI_ROUTE] POST /api/documents/${docId}/reanalyze requestId=${requestId} force=${body.force ?? true}`);

    const lockResult = await withDocumentAnalysisLock(docId, async () => {
      const startMs = Date.now();
      console.log(`[AI_CALL_START] requestId=${requestId} docId=${docId} provider=${process.env.AI_PROVIDER ?? "mock"} purpose=reanalyze`);
      const outcome = await runDocumentAnalysis(docId, { force: body.force ?? true, createFinancialItems: true, autoApply: true, allowWithoutOcr: body.allowWithoutOcr ?? false });
      console.log(`[AI_CALL_END] requestId=${requestId} durationMs=${Date.now() - startMs} status=${outcome.status}`);
      return outcome;
    });

    if (!lockResult.acquired) {
      return NextResponse.json({ status: "already_running", message: "Une analyse est déjà en cours pour ce document." }, { status: 409 });
    }

    const outcome = lockResult.result;
    if (outcome.status === "no-ocr") {
      return NextResponse.json(
        { status: "pending_ocr", message: outcome.message, diagnostics: { ocrLength: 0, reason: outcome.message, confidence: "low", provider: process.env.AI_PROVIDER ?? "mock", model: null } },
        { status: 422 },
      );
    }
    if (outcome.status === "error") {
      return NextResponse.json({ status: "error", message: outcome.message }, { status: 500 });
    }
    return NextResponse.json({
      status: outcome.status,
      analysisId: outcome.analysis.id,
      analysis: outcome.analysis,
      cached: outcome.cached,
      applied: outcome.applied ?? null,
      diagnostics: outcome.diagnostics ?? null,
    });
  } catch (error) {
    console.error(`[AI_ROUTE] reanalyze requestId=${requestId} error:`, error instanceof Error ? error.message : error);
    return jsonError("Impossible de lancer l'analyse IA", error);
  }
}
