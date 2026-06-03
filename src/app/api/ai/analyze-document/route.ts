import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { jsonError } from "@/lib/api-utils";
import { runDocumentAnalysis } from "@/lib/ai/run-document-analysis";
import { withDocumentAnalysisLock } from "@/lib/ai/analysis-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  documentId: number | string;
  force?: boolean;
  /**
   * "fast"   = local rules (<1s), no Ollama.
   * "enrich" = complement local analysis with Ollama (targeted, non-blocking).
   * "ai"     = full Ollama analysis (may be slow).
   * "cloud"  = OpenAI-compatible advanced model.
   */
  mode?: "fast" | "enrich" | "ai" | "cloud";
  /** mode="cloud" uniquement : envoie plus de contexte OCR + tokens (analyse avancée). */
  advanced?: boolean;
  /** Applique automatiquement la classification (défaut true pour analyse explicite). */
  autoApply?: boolean;
};

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    const body = (await request.json()) as Body;
    if (body.documentId === undefined || body.documentId === null) {
      return NextResponse.json({ error: "documentId requis." }, { status: 400 });
    }
    const docId = Number(body.documentId);
    if (!Number.isFinite(docId)) {
      return NextResponse.json({ error: "documentId invalide." }, { status: 400 });
    }

    // Version autonome : par défaut, analyse LOCALE par règles (« fast ») dès qu'aucun
    // fournisseur LLM n'est configuré → fonctionne hors-ligne, sans erreur, et l'analyse
    // est bien persistée. Si AI_PROVIDER (ollama/openai) est défini, on repasse en « ai ».
    const hasAiProvider = !!process.env.AI_PROVIDER && process.env.AI_PROVIDER.toLowerCase() !== "mock";
    const mode = body.mode ?? (process.env.AI_FAST_MODE === "true" || !hasAiProvider ? "fast" : "ai");
    console.log(`[AI_ROUTE] POST /api/ai/analyze-document docId=${docId} requestId=${requestId} force=${body.force ?? false} mode=${mode}`);

    const lockResult = await withDocumentAnalysisLock(docId, async () => {
      const startMs = Date.now();
      console.log(`[AI_CALL_START] requestId=${requestId} docId=${docId} provider=${process.env.AI_PROVIDER ?? "mock"} model=${process.env.OLLAMA_MODEL ?? ""} mode=${mode} purpose=document-analysis`);

      const outcome = await runDocumentAnalysis(docId, {
        force: body.force,
        mode,
        advanced: body.advanced,
        // Compléter (enrich) ne doit pas appliquer la classification ; les analyses
        // explicites (cloud/ai/fast) appliquent par défaut.
        autoApply: mode === "enrich" ? false : (body.autoApply ?? true),
      });

      const durationMs = Date.now() - startMs;
      const success = outcome.status === "ok" || outcome.status === "cached";
      console.log(`[AI_CALL_END] requestId=${requestId} durationMs=${durationMs} success=${success} status=${outcome.status} mode=${mode}`);

      return outcome;
    });

    if (!lockResult.acquired) {
      return NextResponse.json(
        { error: "analysis_already_running", message: "Une analyse est déjà en cours pour ce document. Veuillez patienter." },
        { status: 409 }
      );
    }

    const outcome = lockResult.result;

    if (outcome.status === "no-ocr") {
      return NextResponse.json(
        { error: "no-ocr", message: outcome.message, diagnostics: { ocrLength: 0, reason: outcome.message, confidence: "low", provider: process.env.AI_PROVIDER ?? "mock", model: null } },
        { status: 422 },
      );
    }
    if (outcome.status === "error") {
      return NextResponse.json({ error: outcome.message }, { status: 400 });
    }

    return NextResponse.json({
      analysis: outcome.analysis,
      cached: outcome.cached,
      mode,
      applied: outcome.applied ?? null,
      diagnostics: outcome.diagnostics ?? null,
      enrichmentStatus: outcome.analysis.enrichmentStatus ?? null,
      enrichmentMessage: outcome.analysis.enrichmentMessage ?? null,
    });
  } catch (error) {
    console.error(`[AI_ROUTE] requestId=${requestId} error:`, error instanceof Error ? error.message : error);
    return jsonError("Analyse IA impossible", error);
  }
}
