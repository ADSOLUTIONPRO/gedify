import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { runDocumentAnalysis } from "@/lib/ai/run-document-analysis";
import { finishBatch, recordResult, startBatch } from "@/lib/ai/batch-status-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Plafond de sécurité pour un lot synchrone (évite un appel trop long/coûteux). */
const MAX_BATCH = 50;

type Body = {
  documentIds: number[];
  force?: boolean;
  autoValidate?: boolean;
  createFinancialItems?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const ids = Array.isArray(body.documentIds)
      ? body.documentIds.map(Number).filter((n) => Number.isFinite(n))
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "documentIds requis (liste non vide)." }, { status: 400 });
    }
    const targets = ids.slice(0, MAX_BATCH);

    startBatch(targets.length);
    let autoValidated = 0;

    for (const id of targets) {
      try {
        const outcome = await runDocumentAnalysis(id, {
          force: body.force,
          autoValidate: body.autoValidate,
          createFinancialItems: body.createFinancialItems ?? true,
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

    return NextResponse.json({
      requested: ids.length,
      processed: targets.length,
      autoValidated,
      capped: ids.length > MAX_BATCH,
    });
  } catch (error) {
    finishBatch();
    return jsonError("Analyse par lot impossible", error);
  }
}
