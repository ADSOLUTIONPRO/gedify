import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { runDocumentAnalysis } from "@/lib/ai/run-document-analysis";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { finishBatch, recordResult, startBatch } from "@/lib/ai/batch-status-store";
import { getDocuments } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Plafond de documents balayés en une fois (bornage synchrone). */
const MAX_SCAN = 50;

type Body = {
  /** Réanalyser aussi les documents déjà analysés. */
  force?: boolean;
  autoValidate?: boolean;
  createFinancialItems?: boolean;
  /** Liste explicite (ex. documents visibles / sélectionnés). Sinon, scan global. */
  documentIds?: number[];
  /** Analyser même sans OCR exploitable (vision/document direct). Défaut : true en lot. */
  allowWithoutOcr?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;

    let targets: number[];
    if (Array.isArray(body.documentIds) && body.documentIds.length > 0) {
      targets = body.documentIds.map(Number).filter((n) => Number.isFinite(n));
    } else {
      const docs = await getDocuments({ page_size: MAX_SCAN, ordering: "-added" });
      targets = (docs.results ?? []).map((d) => Number(d.id));
    }

    // Par défaut, n'analyser que les documents sans analyse (préserve l'existant).
    if (!body.force) {
      const analyzed = new Set((await listAnalyses()).map((a) => a.documentId));
      targets = targets.filter((id) => !analyzed.has(id));
    }
    targets = targets.slice(0, MAX_SCAN);

    startBatch(targets.length);
    let autoValidated = 0;
    for (const id of targets) {
      try {
        const outcome = await runDocumentAnalysis(id, {
          force: body.force,
          autoValidate: body.autoValidate,
          createFinancialItems: body.createFinancialItems ?? true,
          allowWithoutOcr: body.allowWithoutOcr ?? true,
        });
        if (outcome.status === "ok") {
          if (outcome.autoValidated) autoValidated += 1;
          recordResult("ok", outcome.autoValidated);
        } else if (outcome.status === "cached") {
          recordResult("skipped");
        } else {
          recordResult("failed", false, outcome.message);
        }
      } catch (error) {
        recordResult("failed", false, error instanceof Error ? error.message : "Erreur inconnue");
      }
    }
    finishBatch();

    return NextResponse.json({ processed: targets.length, autoValidated });
  } catch (error) {
    finishBatch();
    return jsonError("Analyse globale impossible", error);
  }
}
