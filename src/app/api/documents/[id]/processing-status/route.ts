import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { paperlessProxyError } from "@/lib/api-utils";
import { getDocument } from "@/lib/paperless";
import { getPaperlessTasksForDocument, deriveProcessingStatus } from "@/lib/paperless/paperless-tasks";
import { getLatestAnalysisForDocument } from "@/lib/ai/ai-analysis-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Auth is handled by middleware (same as /api/ai/analyze-document).
// A second requireAuth() layer would double-check against the same JWT secret
// in Node.js runtime and can fail when middleware (Edge runtime) already passed.
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const documentId = Number(id);

    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ ok: false, errorType: "bad_request", message: "documentId invalide." }, { status: 400 });
    }

    const [document, tasks, analysis] = await Promise.allSettled([
      getDocument(documentId),
      getPaperlessTasksForDocument(documentId),
      getLatestAnalysisForDocument(documentId),
    ]);

    const doc = document.status === "fulfilled" ? document.value : null;
    const docTasks = tasks.status === "fulfilled" ? tasks.value : [];
    const aiAnalysis = analysis.status === "fulfilled" ? analysis.value : null;

    // Surface Gedify auth errors clearly
    if (document.status === "rejected") {
      const msg = document.reason instanceof Error ? document.reason.message : String(document.reason);
      if (/Gedify 401/.test(msg)) {
        return NextResponse.json(
          { ok: false, errorType: "paperless_auth", message: "Token Gedify invalide ou expiré." },
          { status: 502 }
        );
      }
    }

    const ocrLength = (doc?.content ?? "").trim().length;
    const processingStatus = deriveProcessingStatus(
      documentId,
      docTasks,
      ocrLength,
      aiAnalysis !== null,
      aiAnalysis?.status ?? null,
    );

    return NextResponse.json({
      ok: true,
      ...processingStatus,
      ocrTextLength: ocrLength,
      ocrExtract: ocrLength > 0 ? (doc?.content ?? "").trim().slice(0, 300) : null,
      aiAnalysisId: aiAnalysis?.id ?? null,
      aiAnalysisStatus: aiAnalysis?.status ?? null,
    });
  } catch (error) {
    return paperlessProxyError("Impossible de calculer le statut de traitement", error);
  }
}
