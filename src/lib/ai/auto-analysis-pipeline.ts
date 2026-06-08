import "server-only";

import { runDocumentAnalysis } from "@/lib/ai/run-document-analysis";
import { getGedifyFeatureFlags } from "@/lib/settings/feature-flags";

export type PipelineStatus =
  | "analyzing"
  | "analyzed"
  | "pending_ocr"
  | "analysis_failed"
  | "no_provider"
  | "disabled";

export type PipelineResult = {
  status: PipelineStatus;
  message: string;
  analysisId?: string;
};

/**
 * Lance l'analyse IA d'un document Paperless s'il est prêt (OCR terminé).
 * Ne bloque pas l'import — les erreurs sont capturées silencieusement.
 * N'expose jamais les clés API côté client.
 */
export async function tryAutoAnalyze(documentId: number): Promise<PipelineResult> {
  // Garde « Modules » : l'analyse IA automatique peut être coupée dans les
  // Paramètres (l'analyse manuelle depuis /ia reste toujours possible).
  const { autoAiAnalysisEnabled } = await getGedifyFeatureFlags();
  if (!autoAiAnalysisEnabled) {
    return { status: "disabled", message: "Analyse IA automatique désactivée dans les paramètres." };
  }
  const provider = process.env.AI_PROVIDER;
  if (!provider || provider === "") {
    return { status: "no_provider", message: "Aucun fournisseur IA configuré." };
  }

  try {
    const outcome = await runDocumentAnalysis(documentId, { force: false, createFinancialItems: true });

    if (outcome.status === "no-ocr") {
      return { status: "pending_ocr", message: "OCR non encore disponible — réessayez depuis /ia." };
    }
    if (outcome.status === "error") {
      return { status: "analysis_failed", message: outcome.message };
    }

    return {
      status: "analyzed",
      message: "Analyse IA terminée.",
      analysisId: outcome.analysis.id,
    };
  } catch (err) {
    return {
      status: "analysis_failed",
      message: err instanceof Error ? err.message : "Erreur analyse IA.",
    };
  }
}
