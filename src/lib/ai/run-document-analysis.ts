import "server-only";

import { getActiveAIProvider, getCloudAIProvider } from "@/lib/ai/ai-provider";
import type { AnalyzeResult } from "@/lib/ai/ai-provider";

function getModel(): string {
  return process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
}
import { fastAnalyzeDocument } from "@/lib/ai/fast-document-analysis";
import { callOllamaEnrichment } from "@/lib/ai/ollama-enrichment";
import { getLatestAnalysisForDocument, upsertAnalysis } from "@/lib/ai/ai-analysis-store";
import { autoCreateFinancialItemsFromAnalysis } from "@/lib/ai/auto-create-financial-items";
import { bulkUpsertFromSynthesis } from "@/lib/ai/detected-info-store";
import { synthesizeDetectedInfos } from "@/lib/ai/detected-info-utils";
import { validateAIAnalysisConsistency } from "@/lib/ai/rules/validate-analysis-consistency";
import { sanitizeFinalAnalysis } from "@/lib/ai/rules/final-analysis-sanitizer";
import { getCorrespondents, getDocument, getDocumentTypes, getTags, updateDocument } from "@/lib/paperless";
import { linkProjectDocuments, listProjectFolders } from "@/lib/projects/project-store";
import { getTitleOverride, setTitleOverride } from "@/lib/documents/document-title-store";
import { buildTitleFromAnalysis } from "@/lib/documents/document-title-service";
import { isOcrUsable } from "@/lib/ai/ocr-usability";
import { resolveClassification } from "@/lib/ai/resolve-classification";
import { findTemplateMatch, templateClassificationOverride } from "@/lib/ai/learned-template-apply";
import { getLearnedTemplate } from "@/lib/ai/learned-templates-store";
import type { TemplateMatch } from "@/lib/ai/learned-templates-types";
import { createReminder } from "@/lib/actions/reminder-store";
import { appendGedLog } from "@/lib/ged/ged-store";
import { readSession } from "@/lib/auth/session";
import type { AIAnalysis, AIAnalysisInput, AIAnalysisStatus, AIConfidence } from "@/lib/ai/types";
import type { PaperlessDocument } from "@/lib/paperless-types";

/** Résumé des actions appliquées automatiquement après analyse (pour la popup). */
export type AppliedSummary = {
  autoApplied: boolean;
  fieldsApplied: string[];
  created: string[];
  budgetCreated: number;
  reminderCreated: boolean;
  needsValidation: string[];
  permisSkipped: boolean;
  /** Raison « ignoré » par champ (correspondant/type/tags/dossier/date/rappel). */
  skipReasons: Record<string, string>;
};

export type AnalysisDiagnostics = {
  ocrLength: number;
  provider: string;
  model: string | null;
  confidence: AIConfidence;
  reason: string | null;
};

const DUE_DATE_LABEL = /(éch[ée]ance|limite|paiement|r[èe]glement|\bdue\b|exigib)/i;
/** Libellés indiquant une date à NE PAS utiliser comme date du document. */
const EXCLUDE_DOC_DATE = /(naiss|\bn[ée]e?\b|birth|construct|[ée]difi|cadastr|acquis|historiq|d[ée]c[èe]s|mariage|ancien)/i;
/** Libellés d'une vraie date d'émission/signature du document. */
const STRONG_DOC_DATE = /(document|[ée]mission|facture|sign|courrier|[ée]tabli|d[ée]livr|envoi|edit[ée])/i;

/**
 * Choisit la date du document en évitant les dates parasites (naissance,
 * historique, construction d'un bien…). Préfère un libellé d'émission ;
 * sinon la date la plus récente parmi les dates non-échéance non-exclues.
 */
function pickDocumentDateIso(analysis: AIAnalysis): string | null {
  const all = (analysis.detectedDates ?? []).filter((d) => d.iso);
  if (all.length === 0) return null;
  const usable = all.filter((d) => !EXCLUDE_DOC_DATE.test(d.label) && !DUE_DATE_LABEL.test(d.label));
  const strong = usable.find((d) => STRONG_DOC_DATE.test(d.label));
  if (strong) return strong.iso;
  const pool = usable.length > 0 ? usable : all.filter((d) => !DUE_DATE_LABEL.test(d.label));
  if (pool.length === 0) return all[0].iso;
  // Les dates d'émission sont généralement les plus récentes (hors échéance).
  return [...pool].sort((a, b) => (a.iso < b.iso ? 1 : -1))[0].iso;
}
function pickDueDateIso(analysis: AIAnalysis): string | null {
  return (analysis.detectedDates ?? []).find((d) => DUE_DATE_LABEL.test(d.label))?.iso ?? null;
}

/** Repli : convertit la confiance qualitative en score [0,1] quand le score numérique manque (providers locaux). */
function confidenceToScore(c: AIConfidence): number {
  if (c === "high") return 0.9;
  if (c === "medium") return 0.6;
  return 0.3;
}

/** Score de confiance numérique d'une analyse (numérique si dispo, sinon repli qualitatif). */
function analysisScore(analysis: AIAnalysis): number {
  return analysis.globalConfidenceScore ?? confidenceToScore(analysis.confidence);
}

function diagnoseReason(analysis: AIAnalysis, ocrLength: number): string | null {
  if (ocrLength < 20) return "OCR vide ou trop court — l'OCR Paperless n'est peut-être pas terminé.";
  if ((analysis.provider ?? "").includes("fallback-mock")) return "Provider IA indisponible — analyse de secours (rule-based) utilisée.";
  if (analysis.enrichmentStatus === "timeout") return "Délai IA dépassé (timeout). Augmentez le timeout ou réessayez.";
  if (analysis.confidence === "low") return "Confiance faible — informations à vérifier manuellement.";
  return null;
}

/**
 * Étape finale commune : titre IA, infos détectées, **résolution noms→IDs +
 * création d'entités**, **budget**, **auto-application des champs vides si
 * confiance haute**, **rappel d'échéance**, historique. Renvoie le résumé pour
 * la popup de résultat.
 */
async function finalizeAnalysis(
  documentId: number,
  document: PaperlessDocument,
  analysis: AIAnalysis,
  opts: { mode: RunAnalysisMode; autoApply: boolean; createFinancialItems: boolean },
): Promise<{ analysis: AIAnalysis; applied: AppliedSummary; diagnostics: AnalysisDiagnostics }> {
  const ocrText = document.content ?? "";
  const ocrLength = ocrText.length;
  const tagsBefore = Array.isArray(document.tags) ? (document.tags as number[]) : [];

  // Titre via le SERVICE CENTRAL (convention déterministe > IA libre > fichier).
  // Jamais par-dessus une correction utilisateur. Seuils de confiance :
  //   ≥ 0.60 → appliquer (≥0.85 = convention/haute confiance) ; < 0.60 → ne pas écraser.
  {
    const existing = await getTitleOverride(documentId);
    if (!existing?.editedByUser) {
      const fileName = document.original_file_name ?? document.original_filename ?? document.filename ?? null;
      // Réutilise le motif de titre du document similaire validé (modèle appris).
      const tplPattern = analysis.matchedTemplateId
        ? (await getLearnedTemplate(analysis.matchedTemplateId).catch(() => null))?.titlePattern ?? null
        : null;
      const built = buildTitleFromAnalysis(analysis, fileName, tplPattern);
      if (built.title && built.title.length >= 3 && built.confidence >= 0.6) {
        const src = built.source === "convention" ? "rule" : built.source; // convention déterministe = "rule"
        await setTitleOverride(documentId, built.title, src, built.confidence, false);
      }
    }
  }

  await bulkUpsertFromSynthesis(synthesizeDetectedInfos(analysis));

  const applied: AppliedSummary = {
    autoApplied: false, fieldsApplied: [], created: [], budgetCreated: 0,
    reminderCreated: false, needsValidation: [], permisSkipped: false, skipReasons: {},
  };

  // Résolution noms → IDs (+ création anti-doublon). Réécrit sur l'analyse.
  let working = analysis;
  let resolved: Awaited<ReturnType<typeof resolveClassification>> | null = null;
  try {
    resolved = await resolveClassification({
      correspondentName: analysis.suggestedCorrespondentName,
      documentTypeName: analysis.suggestedDocumentTypeName,
      tagNames: analysis.suggestedTagNames,
      folderName: analysis.suggestedFolderName,
      ocrText,
    });
    applied.permisSkipped = resolved.permisSkipped;
    working = await upsertAnalysis({
      ...analysis,
      id: analysis.id,
      documentId,
      suggestedCorrespondentId: resolved.correspondent?.id ?? analysis.suggestedCorrespondentId,
      suggestedDocumentTypeId: resolved.documentType?.id ?? analysis.suggestedDocumentTypeId,
      suggestedTagIds: resolved.tags.length ? resolved.tags.map((t) => t.id) : analysis.suggestedTagIds,
    });
  } catch (error) {
    console.error(`[AI_APPLY] resolve failed docId=${documentId}: ${error instanceof Error ? error.message : error}`);
  }

  // Budget (depuis financialImpact) — comportement existant, capturé pour la popup.
  if (opts.createFinancialItems) {
    try {
      const budget = await autoCreateFinancialItemsFromAnalysis(working, { documentTitle: document.title ?? null });
      applied.budgetCreated = budget.created.length;
    } catch (error) {
      console.error(`[AI_APPLY] budget failed docId=${documentId}: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Seuil d'auto-application : score de confiance numérique ≥ 0.75 (§1).
  const score = analysisScore(working);
  const eligible =
    opts.autoApply &&
    score >= 0.75 &&
    (working.warnings?.length ?? 0) === 0 &&
    working.autoApplyEligible !== false &&
    !working.blockedAutoApplyReason;

  let appliedFolderName: string | null = null;

  if (eligible && resolved) {
    const patch: { correspondent?: number; document_type?: number; tags?: number[]; created?: string } = {};
    if (resolved.correspondent) {
      if (document.correspondent == null) { patch.correspondent = resolved.correspondent.id; applied.fieldsApplied.push("correspondant"); }
      else applied.needsValidation.push("correspondant");
    }
    if (resolved.documentType) {
      if (document.document_type == null) { patch.document_type = resolved.documentType.id; applied.fieldsApplied.push("type"); }
      else applied.needsValidation.push("type");
    }
    if (resolved.tags.length > 0) {
      const toAdd = resolved.tags.map((t) => t.id).filter((id) => !tagsBefore.includes(id));
      if (toAdd.length > 0) { patch.tags = [...tagsBefore, ...toAdd]; applied.fieldsApplied.push(`tags (${toAdd.length})`); }
    }
    const docDate = pickDocumentDateIso(working);
    if (docDate && document.created == null) { patch.created = docDate; applied.fieldsApplied.push("date"); }

    if (Object.keys(patch).length > 0) {
      try { await updateDocument(documentId, patch); } catch (error) { console.error(`[AI_APPLY] updateDocument failed docId=${documentId}: ${error instanceof Error ? error.message : error}`); }
    }

    // Dossier / projet : classement automatique (§3) — rattachement non destructif.
    if (resolved.folder) {
      try {
        await linkProjectDocuments(resolved.folder.id, [documentId]);
        appliedFolderName = resolved.folder.name;
        applied.fieldsApplied.push("dossier");
        if (resolved.folder.created) applied.created.push(resolved.folder.name);
      } catch (error) {
        console.error(`[AI_APPLY] folder link failed docId=${documentId}: ${error instanceof Error ? error.message : error}`);
      }
    }

    for (const e of [resolved.correspondent, resolved.documentType]) if (e?.created) applied.created.push(e.name);
    for (const t of resolved.tags) if (t.created) applied.created.push(t.name);
    applied.autoApplied = applied.fieldsApplied.length > 0;

    // Rappel d'échéance (confiance haute).
    const dueIso = pickDueDateIso(working);
    if (dueIso) {
      try {
        await createReminder({ title: document.title ?? `Échéance — document ${documentId}`, remindAt: dueIso, documentId, priority: "high" });
        applied.reminderCreated = true;
      } catch { /* best-effort */ }
    }
  } else if (resolved) {
    if (resolved.correspondent) applied.needsValidation.push("correspondant");
    if (resolved.documentType) applied.needsValidation.push("type");
    if (resolved.tags.length) applied.needsValidation.push("tags");
    if (resolved.folder) applied.needsValidation.push("dossier");
  }

  // Raison « ignoré » par champ, pour expliquer la progression dans la popup.
  // Distingue : déjà renseigné (gardé tel quel) · à valider (gate de confiance) ·
  // aucune suggestion · aucune échéance — pour repérer un éventuel bug.
  const pct = Math.round(score * 100);
  const blockReason: string | null = eligible
    ? null
    : !opts.autoApply
      ? "validation manuelle demandée"
      : working.blockedAutoApplyReason
        ? working.blockedAutoApplyReason
        : (working.warnings?.length ?? 0) > 0
          ? "l'analyse signale des points à vérifier"
          : working.autoApplyEligible === false
            ? "règle de prudence — à confirmer"
            : `confiance ${pct} % (seuil 75 %)`;

  if (resolved) {
    const heldField = (field: string, hasSuggestion: boolean, alreadySet: boolean, keptLabel: string) => {
      if (applied.fieldsApplied.includes(field)) return; // appliqué → pas de raison
      if (!hasSuggestion) applied.skipReasons[field] = "aucune suggestion fiable de l'IA";
      else if (blockReason) applied.skipReasons[field] = `à valider — ${blockReason}`;
      else if (alreadySet) applied.skipReasons[field] = keptLabel;
      else applied.skipReasons[field] = "aucune modification nécessaire";
    };
    heldField("correspondant", !!resolved.correspondent, document.correspondent != null, "déjà renseigné — conservé");
    heldField("type", !!resolved.documentType, document.document_type != null, "déjà renseigné — conservé");
    heldField("dossier", !!resolved.folder, false, "déjà classé");
    if (!applied.fieldsApplied.some((f) => f.startsWith("tags"))) {
      if (!resolved.tags.length) applied.skipReasons.tags = "aucun tag suggéré";
      else if (blockReason) applied.skipReasons.tags = `à valider — ${blockReason}`;
      else applied.skipReasons.tags = "tags déjà présents";
    }
  } else {
    for (const f of ["correspondant", "type", "tags", "dossier"]) applied.skipReasons[f] = "analyse incomplète — résolution impossible";
  }
  if (!applied.reminderCreated) {
    const dueIso = pickDueDateIso(working);
    applied.skipReasons.rappel = !dueIso
      ? "aucune échéance détectée"
      : blockReason
        ? `à valider — ${blockReason}`
        : "échéance déjà couverte";
  }

  // Persistance des champs de statut (confiance, dossier appliqué, à vérifier).
  try {
    working = await upsertAnalysis({
      ...working,
      id: working.id,
      documentId,
      needsReview: !eligible || working.classificationSource === "similar",
      appliedFolderName: appliedFolderName ?? working.appliedFolderName ?? null,
    });
  } catch { /* best-effort */ }

  // Historique
  try {
    const session = await readSession();
    const author = session?.username ?? "Système";
    const parts = [
      `confiance ${Math.round(score * 100)} %`,
      applied.fieldsApplied.length ? `champs: ${applied.fieldsApplied.join(", ")}` : null,
      appliedFolderName ? `dossier: ${appliedFolderName}` : null,
      applied.created.length ? `créés: ${applied.created.join(", ")}` : null,
      applied.budgetCreated ? `budget: ${applied.budgetCreated}` : null,
      applied.reminderCreated ? "rappel" : null,
      applied.permisSkipped ? "Permis de conduire ignoré" : null,
      eligible ? null : "à vérifier",
    ].filter(Boolean);
    await appendGedLog({
      level: "success",
      source: "GED",
      documentId,
      user: session?.username ?? null,
      message: `Analyse IA — ${author} — ${parts.join(" · ")}`,
    });
  } catch { /* best-effort */ }

  const diagnostics: AnalysisDiagnostics = {
    ocrLength,
    provider: working.provider ?? process.env.AI_PROVIDER ?? "mock",
    model: opts.mode === "cloud" ? (process.env.AI_CLOUD_MODEL ?? process.env.OPENAI_MODEL ?? null) : (process.env.OLLAMA_MODEL ?? null),
    confidence: working.confidence,
    reason: diagnoseReason(working, ocrLength),
  };

  console.log(
    `[AI_APPLY] docId=${documentId} mode=${opts.mode} provider=${diagnostics.provider} confidence=${diagnostics.confidence}` +
    ` tagsBefore=${tagsBefore.length} tagsProposed=${(analysis.suggestedTagNames ?? []).length} fieldsApplied=[${applied.fieldsApplied.join(",")}]` +
    ` permisSkipped=${applied.permisSkipped} budgetCreated=${applied.budgetCreated} reminder=${applied.reminderCreated}`
  );

  return { analysis: working, applied, diagnostics };
}

/**
 * Court-circuit « modèle appris » : extraction locale (dates/montants) + le
 * CLASSEMENT du modèle validé précédemment, sans appel OpenAI. Renvoie null si
 * échec (on bascule alors sur l'analyse classique).
 */
async function applyLearnedTemplate(
  documentId: number,
  document: PaperlessDocument,
  analyzeContext: Parameters<typeof fastAnalyzeDocument>[0],
  match: TemplateMatch,
  opts: { autoApply: boolean; createFinancialItems: boolean },
): Promise<RunAnalysisOutcome | null> {
  try {
    const fast = await fastAnalyzeDocument(analyzeContext);
    if (!fast.ok) return null;
    const consistency = validateAIAnalysisConsistency(fast.result, document.content ?? "", analyzeContext.fileName ?? null);
    const base = sanitizeFinalAnalysis(consistency.correctedAnalysis);
    const stored = await upsertAnalysis({
      ...base,
      ...templateClassificationOverride(match),
      documentId,
      status: "ready-to-validate",
      originalSuggestion: consistency.originalSuggestion,
      ruleMatches: consistency.ruleMatches,
      blockedAutoApplyReason: null,
    });
    const fin = await finalizeAnalysis(documentId, document, stored, { mode: "ai", autoApply: opts.autoApply, createFinancialItems: opts.createFinancialItems });
    try {
      const session = await readSession();
      await appendGedLog({
        level: "success", source: "GED", documentId, user: session?.username ?? null,
        message: `Modèle appris appliqué — ${match.template.label} · similarité ${Math.round(match.score * 100)} %`,
      });
    } catch { /* best-effort */ }
    return { status: "ok", analysis: fin.analysis, cached: false, autoValidated: false, applied: fin.applied, diagnostics: fin.diagnostics };
  } catch {
    return null;
  }
}

export type RunAnalysisMode = "fast" | "ai" | "cloud" | "enrich";

export type RunAnalysisOptions = {
  /** Réanalyser même si une analyse existe déjà. */
  force?: boolean;
  /** Valider automatiquement si l'analyse est très fiable (état uniquement). */
  autoValidate?: boolean;
  /** Créer les propositions budgétaires « à contrôler ». */
  createFinancialItems?: boolean;
  /**
   * "fast" : règles locales uniquement, <1s, jamais d'appel Ollama.
   * "ai"   : provider IA configuré (Ollama/OpenAI), peut être long.
   * Default: "ai" sauf si AI_FAST_MODE=true, auquel cas "fast".
   */
  mode?: RunAnalysisMode;
  /** Mode cloud « avancé » (plus de contexte OCR + tokens) — uniquement si mode="cloud". */
  advanced?: boolean;
  /** Applique automatiquement la classification aux champs vides si confiance haute. */
  autoApply?: boolean;
  /** Ignore les modèles appris (force une analyse OpenAI profonde). */
  ignoreLearned?: boolean;
  /**
   * Autorise l'analyse SANS OCR exploitable (texte natif PDF / métadonnées /
   * vision selon le fournisseur). L'OCR devient facultatif, pas bloquant.
   */
  allowWithoutOcr?: boolean;
};

export type RunAnalysisOutcome =
  | { status: "ok"; analysis: AIAnalysis; cached: false; autoValidated: boolean; applied?: AppliedSummary; diagnostics?: AnalysisDiagnostics }
  | { status: "cached"; analysis: AIAnalysis; cached: true; autoValidated: boolean; applied?: AppliedSummary; diagnostics?: AnalysisDiagnostics }
  | { status: "no-ocr"; message: string }
  | { status: "error"; message: string };

/**
 * Critère d'auto-validation : très fiable, aucun warning, et l'auto-apply n'a
 * pas été bloqué par les règles de cohérence (CAF/DGFIP…). On ne pousse JAMAIS
 * vers la GED automatiquement — on se contente de marquer l'état `validated`
 * (réversible). Les corrections utilisateur restent prioritaires en amont.
 */
function isAutoValidatable(analysis: AIAnalysis): boolean {
  return (
    analysis.confidence === "high" &&
    (analysis.warnings?.length ?? 0) === 0 &&
    analysis.autoApplyEligible === true &&
    !analysis.blockedAutoApplyReason
  );
}

/**
 * Analyse un document côté serveur (réutilise tout le pipeline existant :
 * provider IA → règles de cohérence → persistance analyse + titre IA +
 * informations détectées éditables + propositions budgétaires).
 *
 * Jamais d'exposition de clé : tout reste serveur. Ne réécrit jamais une
 * correction de titre faite par l'utilisateur.
 */
function resolveMode(requested?: RunAnalysisMode): RunAnalysisMode {
  if (requested) return requested;
  if (process.env.AI_FAST_MODE === "true" || process.env.AI_USE_RULES_FIRST === "true") return "fast";
  return "ai";
}

/** Taxonomies existantes (bornées) à fournir au modèle cloud pour réutilisation. */
async function loadExistingTaxonomies(): Promise<{
  existingCorrespondents: string[];
  existingDocumentTypes: string[];
  existingTags: string[];
  existingFolders: string[];
}> {
  try {
    const [corr, types, tags, folders] = await Promise.all([
      getCorrespondents({ page_size: 500 }).then((r) => (r.results ?? []).map((c) => c.name)),
      getDocumentTypes({ page_size: 500 }).then((r) => (r.results ?? []).map((t) => t.name)),
      getTags({ page_size: 500 }).then((r) => (r.results ?? []).map((t) => t.name)),
      listProjectFolders().then((p) => p.map((f) => f.name)).catch(() => [] as string[]),
    ]);
    return {
      existingCorrespondents: corr.slice(0, 200),
      existingDocumentTypes: types.slice(0, 200),
      existingTags: tags.slice(0, 200),
      existingFolders: folders.slice(0, 200),
    };
  } catch {
    return { existingCorrespondents: [], existingDocumentTypes: [], existingTags: [], existingFolders: [] };
  }
}

export async function runDocumentAnalysis(
  documentId: number,
  options: RunAnalysisOptions = {}
): Promise<RunAnalysisOutcome> {
  const { force = false, autoValidate = false, createFinancialItems = true, autoApply = false } = options;
  const mode = resolveMode(options.mode);

  if (!Number.isFinite(documentId)) {
    return { status: "error", message: "documentId invalide." };
  }

  if (!force) {
    const cached = await getLatestAnalysisForDocument(documentId);
    if (cached) {
      return { status: "cached", analysis: cached, cached: true, autoValidated: false };
    }
  }

  const document = await getDocument(documentId);
  const ocrContent = (document.content ?? "").trim();
  // OCR FACULTATIF + EXPLOITABILITÉ (§16) : on bloque (→ confirmation UI) si
  // l'OCR est absent, trop court, trop pauvre ou illisible, SAUF si l'appelant
  // autorise l'analyse directe (allowWithoutOcr : texte natif/métadonnées/vision).
  const ocrUsable = isOcrUsable(ocrContent);
  if (!ocrUsable && !options.allowWithoutOcr) {
    return {
      status: "no-ocr",
      message:
        "Ce document n'a pas encore de contenu OCR exploitable. Lancez l'OCR puis recommencez, ou lancez l'analyse directe.",
    };
  }
  const inputMode: "ocr_text" | "document_vision" = ocrUsable ? "ocr_text" : "document_vision";
  if (inputMode === "document_vision") console.log(`[AI] analyse SANS OCR (mode=${inputMode}) doc=${documentId} — texte natif/métadonnées`);

  const analyzeContext = {
    documentId,
    title: document.title ?? `Document ${documentId}`,
    content: document.content ?? "",
    fileName: document.original_file_name ?? document.original_filename ?? document.filename,
    correspondentName: document.correspondent__name ?? null,
    documentTypeName: document.document_type__name ?? null,
    created: document.created ?? null,
    added: document.added ?? null,
    cloudAdvanced: options.advanced === true,
  };

  // ── Apprentissage : reconnaissance d'un document similaire (modèle appris) ──
  let templateMatch: TemplateMatch | null = null;
  if ((mode === "cloud" || mode === "ai") && !options.ignoreLearned) {
    templateMatch = await findTemplateMatch(document, ocrContent).catch(() => null);
    if (templateMatch && templateMatch.score >= templateMatch.template.confidenceThreshold) {
      const applied = await applyLearnedTemplate(documentId, document, analyzeContext, templateMatch, { autoApply, createFinancialItems });
      if (applied) return applied;
    }
  }
  // Champs « source » à attacher à l'analyse classique (zone 0.70–0.84 = « similaire »).
  const sourceFields: AIAnalysisInput =
    templateMatch && templateMatch.score >= 0.7
      ? { classificationSource: "similar", matchedTemplateId: templateMatch.template.id, matchedTemplateLabel: templateMatch.template.label, similarityScore: templateMatch.score }
      : { classificationSource: "openai" };

  // ── Enrich mode: complement existing local analysis — never blocks ────────
  if (mode === "enrich") {
    // Load or create the local analysis first
    const existingAnalysis = await getLatestAnalysisForDocument(documentId);
    let baseAnalysis = existingAnalysis;

    if (!baseAnalysis) {
      // No local analysis yet — create one fast before enriching
      const fastOutcome = await runDocumentAnalysis(documentId, { force: false, mode: "fast", createFinancialItems: false });
      if (fastOutcome.status === "ok" || fastOutcome.status === "cached") {
        baseAnalysis = fastOutcome.analysis;
      } else {
        return fastOutcome; // no OCR or error
      }
    }

    // Call Ollama enrichment — never throws, returns timeout/error gracefully
    const enrichResult = await callOllamaEnrichment(baseAnalysis, document.content ?? "");

    if (enrichResult.status === "done") {
      const enriched = await upsertAnalysis({
        ...baseAnalysis,
        ...enrichResult.patch,
        id: baseAnalysis.id,
        documentId,
        enrichmentStatus: "done",
        enrichmentMessage: null,
        provider: `ollama-enrich:${getModel()}`,
      });
      return { status: "ok", analysis: enriched, cached: false, autoValidated: false };
    }

    // Timeout or error — update status on existing analysis, return it
    const updated = await upsertAnalysis({
      ...baseAnalysis,
      id: baseAnalysis.id,
      documentId,
      enrichmentStatus: enrichResult.status,
      enrichmentMessage: enrichResult.message,
    });
    return { status: "ok", analysis: updated, cached: false, autoValidated: false };
  }

  let rawResult;
  let consistency;

  if (mode === "fast") {
    // Local rules only — no network, <1s
    const fastResult = await fastAnalyzeDocument(analyzeContext);
    if (!fastResult.ok) {
      return { status: "error", message: `Analyse locale impossible : ${fastResult.error}` };
    }
    rawResult = fastResult.result;
    consistency = validateAIAnalysisConsistency(
      rawResult,
      document.content ?? "",
      analyzeContext.fileName ?? null
    );
  } else if (mode === "cloud") {
    // Cloud AI — non-blocking: timeout returns local analysis with enrichment status
    const existingAnalysis = await getLatestAnalysisForDocument(documentId);
    let baseAnalysis = existingAnalysis;

    if (!baseAnalysis) {
      // Ensure a local analysis exists before enriching
      const fastOutcome = await runDocumentAnalysis(documentId, {
        force: false, mode: "fast", createFinancialItems: false,
      });
      if (fastOutcome.status === "ok" || fastOutcome.status === "cached") {
        baseAnalysis = fastOutcome.analysis;
      } else {
        return fastOutcome;
      }
    }

    let cloudResult: AnalyzeResult | null = null;
    let cloudError: string | null = null;
    let isCloudTimeout = false;

    try {
      const provider = getCloudAIProvider();
      // Injecter les taxonomies existantes pour que le modèle les réutilise.
      const cloudContext = { ...analyzeContext, ...(await loadExistingTaxonomies()) };
      cloudResult = await provider.analyzeDocument(cloudContext);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const timeout = msg.toLowerCase().includes("indisponible après") || msg.includes("TimeoutError") || msg.includes("signal timed out") || msg.includes("The operation was aborted");
      isCloudTimeout = timeout;
      cloudError = msg;
      console.error(`[AI_CLOUD] cloud mode error (non-blocking): ${msg}`);
    }

    if (cloudResult) {
      // Cloud succeeded — run consistency check and sanitize
      const cloudConsistency = validateAIAnalysisConsistency(
        cloudResult,
        document.content ?? "",
        analyzeContext.fileName ?? null
      );
      const cloudCorrected = sanitizeFinalAnalysis(cloudConsistency.correctedAnalysis);
      const stored = await upsertAnalysis({
        ...cloudCorrected,
        ...sourceFields,
        documentId,
        status: "ready-to-validate",
        originalSuggestion: cloudConsistency.originalSuggestion,
        ruleMatches: cloudConsistency.ruleMatches,
        blockedAutoApplyReason: cloudConsistency.blockedAutoApplyReason,
        richData: cloudResult.richData ?? null,
        enrichmentStatus: "done",
        enrichmentMessage: null,
        provider: cloudResult.provider,
      });
      const fin = await finalizeAnalysis(documentId, document, stored, { mode: "cloud", autoApply, createFinancialItems });
      return { status: "ok", analysis: fin.analysis, cached: false, autoValidated: false, applied: fin.applied, diagnostics: fin.diagnostics };
    }

    // Timeout or error — keep local analysis, surface enrichment status
    const updated = await upsertAnalysis({
      ...baseAnalysis,
      id: baseAnalysis.id,
      documentId,
      enrichmentStatus: isCloudTimeout ? "timeout" : "error",
      enrichmentMessage: cloudError,
    });
    return { status: "ok", analysis: updated, cached: false, autoValidated: false };
  } else {
    // AI provider (Ollama / OpenAI)
    const provider = getActiveAIProvider();
    rawResult = await provider.analyzeDocument(analyzeContext);
    consistency = validateAIAnalysisConsistency(
      rawResult,
      document.content ?? "",
      analyzeContext.fileName ?? null
    );
  }

  // Final anti-contradiction pass (fixes wrong summary/tags after rule application)
  const result = sanitizeFinalAnalysis(consistency.correctedAnalysis);

  const provisional = await upsertAnalysis({
    ...result,
    ...sourceFields,
    documentId,
    status: "ready-to-validate",
    originalSuggestion: consistency.originalSuggestion,
    ruleMatches: consistency.ruleMatches,
    blockedAutoApplyReason: consistency.blockedAutoApplyReason,
    // richData from cloud provider (pay slip structured fields)
    richData: rawResult.richData ?? null,
  });

  const autoValidated = autoValidate && isAutoValidatable(provisional);
  let analysis = provisional;
  if (autoValidated) {
    const status: AIAnalysisStatus = "validated";
    analysis = await upsertAnalysis({ ...provisional, documentId, status });
  }

  const fin = await finalizeAnalysis(documentId, document, analysis, { mode, autoApply, createFinancialItems });

  return { status: "ok", analysis: fin.analysis, cached: false, autoValidated, applied: fin.applied, diagnostics: fin.diagnostics };
}
