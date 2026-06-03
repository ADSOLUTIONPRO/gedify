/**
 * Lancement des actions IA d'un document depuis le client (grille, sidebar,
 * page détail). Chaque action mappe vers le bon endpoint / mode backend.
 * Aucun modèle en dur : le backend lit les variables `AI_*`.
 */

export type AiActionId =
  | "analyse" // BOUTON PRINCIPAL : analyse profonde cloud OpenAI (advanced + auto-apply)
  | "rapide" // cloud principal (AI_CLOUD_MODEL), contexte OCR standard
  | "avancee" // cloud, plus de contexte OCR + tokens (AI_CLOUD_*)
  | "locale" // Ollama (jamais le cloud)
  | "reanalyser" // relance via le provider global
  | "completer" // enrich : complète les champs faibles (Ollama)
  | "valider" // applique la dernière analyse au document
  | "ocr"; // relance l'OCR Paperless

const SUCCESS: Record<AiActionId, string> = {
  analyse: "Analyse IA terminée",
  rapide: "Analyse terminée",
  avancee: "Analyse avancée terminée",
  locale: "Analyse locale terminée",
  reanalyser: "Analyse relancée",
  completer: "Champs complétés",
  valider: "Informations validées",
  ocr: "OCR relancé",
};

async function post(url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Résumé des applications auto (popup de résultat). */
export type AiApplied = {
  autoApplied: boolean;
  fieldsApplied: string[];
  created: string[];
  budgetCreated: number;
  reminderCreated: boolean;
  needsValidation: string[];
  permisSkipped: boolean;
  /** Raison « ignoré » par champ (correspondant/type/tags/dossier/rappel). */
  skipReasons?: Record<string, string>;
};
export type AiDiagnostics = {
  ocrLength: number;
  provider: string;
  model: string | null;
  confidence: string;
  reason: string | null;
};
/** Analyse renvoyée par l'API (champs lus par la popup ; forme souple). */
export type AiAnalysisShape = {
  summary?: string | null;
  suggestedTitle?: string | null;
  suggestedCorrespondentName?: string | null;
  secondaryCorrespondentNames?: string[];
  suggestedDocumentTypeName?: string | null;
  suggestedFolderName?: string | null;
  suggestedTagNames?: string[];
  detectedDates?: { label: string; iso: string }[];
  detectedAmounts?: { label: string; amount: number; currency: string; kind?: string }[];
  financialImpact?: { kind: string; amount: number; currency?: string }[];
  confidence?: string;
  globalConfidenceScore?: number | null;
  warnings?: { code: string; message: string }[];
  appliedFields?: string[];
  needsReview?: boolean;
  classificationSource?: string;
  matchedTemplateLabel?: string | null;
  similarityScore?: number | null;
};
export type AiActionData = {
  analysis?: AiAnalysisShape | null;
  applied?: AiApplied | null;
  diagnostics?: AiDiagnostics | null;
};
export type AiActionResult = { ok: boolean; message: string; data?: AiActionData };

/** Actions qui produisent un résultat d'analyse → popup. */
export const ANALYSIS_ACTIONS: AiActionId[] = ["analyse", "rapide", "avancee", "locale", "reanalyser"];

/** Exécute une action IA et renvoie un résultat exploitable pour l'UI. */
export async function runAiAction(documentId: number, action: AiActionId): Promise<AiActionResult> {
  try {
    let res: Response;
    switch (action) {
      case "analyse":
        // Bouton principal : analyse profonde OpenAI (cloud + advanced + apply auto).
        res = await post(`/api/ai/analyze-document`, { documentId, mode: "cloud", advanced: true, autoApply: true, force: true });
        break;
      case "rapide":
        res = await post(`/api/ai/analyze-document`, { documentId, mode: "cloud", force: true });
        break;
      case "avancee":
        res = await post(`/api/ai/analyze-document`, { documentId, mode: "cloud", advanced: true, force: true });
        break;
      case "locale":
        res = await post(`/api/ai/analyze-document`, { documentId, mode: "ai", force: true });
        break;
      case "completer":
        res = await post(`/api/ai/analyze-document`, { documentId, mode: "enrich" });
        break;
      case "reanalyser":
        res = await post(`/api/documents/${documentId}/reanalyze`, { force: true });
        break;
      case "valider":
        res = await post(`/api/documents/${documentId}/apply-analysis`);
        break;
      case "ocr":
        res = await post(`/api/documents/${documentId}/redo-ocr`);
        break;
    }
    const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string } & AiActionData;
    const data: AiActionData = { analysis: json.analysis ?? null, applied: json.applied ?? null, diagnostics: json.diagnostics ?? null };
    if (!res.ok) return { ok: false, message: json.message || json.error || `Erreur ${res.status}`, data };
    return { ok: true, message: json.message || SUCCESS[action], data };
  } catch {
    return { ok: false, message: "Échec — réessayez." };
  }
}

const LABELS: Record<AiActionId, string> = {
  analyse: "Analyse IA",
  rapide: "Analyse IA rapide",
  avancee: "Analyse IA avancée",
  locale: "Analyse locale",
  reanalyser: "Ré-analyser",
  completer: "Compléter avec IA",
  valider: "Valider les infos",
  ocr: "Relancer OCR",
};

/** Journalise l'action dans l'historique GED du document. */
export async function logAiAction(documentId: number, action: AiActionId, ok: boolean, user?: string | null): Promise<void> {
  await fetch("/api/ged/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      level: ok ? "success" : "error",
      source: "GED",
      message: `${LABELS[action]} — ${user ?? "système"} — ${ok ? "Succès" : "Erreur"}`,
      documentId,
      user: user ?? null,
    }),
  }).catch(() => {});
}
