import "server-only";

import {
  DocumentAnalysisSchema,
  type AIRichAnalysis,
} from "./schemas/document-analysis-schema";
import type { AnalyzeResult } from "./ai-provider";
import type {
  AIConfidence,
  AIDetectedAmount,
  AIDetectedDate,
  AIDetectedReference,
  AIFinancialImpact,
  AIFinancialKind,
  AIRecommendedAction,
  AIRecommendedActionType,
  AIUrgency,
} from "./types";

/**
 * Erreur contrôlée levée lorsque la sortie IA ne respecte pas le schéma.
 * Inclut les détails Zod (path, message) pour debug et un échantillon de la
 * réponse brute pour permettre une investigation rapide.
 */
export class AIStructuredOutputError extends Error {
  readonly issues: ReadonlyArray<{ path: string; message: string }>;
  readonly rawSnippet: string;

  constructor(message: string, issues: ReadonlyArray<{ path: string; message: string }>, raw: string) {
    super(message);
    this.name = "AIStructuredOutputError";
    this.issues = issues;
    this.rawSnippet = raw.slice(0, 600);
  }
}

export type ParseResult =
  | { ok: true; data: AIRichAnalysis }
  | { ok: false; error: AIStructuredOutputError };

/**
 * Valide une chaîne JSON renvoyée par le LLM contre le schéma strict.
 * Ne lève jamais d'exception au caller : retourne toujours un `ParseResult`.
 */
export function parseAiAnalysisResponse(raw: string): ParseResult {
  if (!raw || raw.trim().length === 0) {
    return {
      ok: false,
      error: new AIStructuredOutputError("Réponse vide.", [], ""),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: new AIStructuredOutputError(
        "Réponse IA non-JSON. Aucune application possible.",
        [],
        raw
      ),
    };
  }

  const validation = DocumentAnalysisSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join(".") : "<root>",
      message: issue.message,
    }));
    return {
      ok: false,
      error: new AIStructuredOutputError(
        `Sortie IA invalide vis-à-vis du schéma (${issues.length} erreur(s)).`,
        issues,
        raw
      ),
    };
  }

  return { ok: true, data: validation.data };
}

/**
 * Calcule `autoApplyEligible` côté serveur en dur, indépendamment du LLM.
 *
 * Garantie : aucun classement automatique ne peut être déclenché si
 *  - warnings non vide,
 *  - correspondent.needsReview ou classification.needsReview est true,
 *  - les confiances correspondent/classification < 0.7,
 *  - globalConfidence < 0.6.
 *
 * Cette fonction écrase la valeur fournie par le modèle si elle est plus
 * permissive que la politique locale.
 */
export function computeAutoApplyEligible(rich: AIRichAnalysis): boolean {
  if (rich.warnings.length > 0) return false;
  if (rich.correspondent.needsReview) return false;
  if (rich.classification.needsReview) return false;
  if (rich.correspondent.confidence < 0.7) return false;
  if (rich.classification.confidence < 0.7) return false;
  if (rich.globalConfidence < 0.6) return false;
  // Garde-fou supplémentaire : impossible d'auto-appliquer sans correspondant.
  if (!rich.correspondent.name) return false;
  return rich.autoApplyEligible;
}

/**
 * Convertit la confiance numérique en confiance qualitative (low/medium/high)
 * pour conserver la compatibilité avec les types AIAnalysis existants.
 */
function bucketConfidence(value: number): AIConfidence {
  if (value >= 0.75) return "high";
  if (value >= 0.45) return "medium";
  return "low";
}

const ACTION_TYPES: AIRecommendedActionType[] = [
  "pay",
  "reply",
  "forward",
  "verify",
  "classify",
  "follow-up",
  "sign",
  "send",
  "keep",
  "archive",
  "call",
  "prepare",
  "declare",
  "contest",
];

const URGENCY_VALUES: AIUrgency[] = ["info", "normal", "important", "urgent"];

const FINANCIAL_KINDS: AIFinancialKind[] = [
  "income",
  "expense",
  "debt",
  "refund",
  "invoice",
  "subscription",
  "due",
  "allowance",
  "benefit",
  "tax",
  "credit",
  "loan",
  "fees",
  "other",
];

function clampAction(type: string): AIRecommendedActionType {
  return (ACTION_TYPES as string[]).includes(type)
    ? (type as AIRecommendedActionType)
    : "classify";
}

function clampUrgency(value: string): AIUrgency {
  return (URGENCY_VALUES as string[]).includes(value)
    ? (value as AIUrgency)
    : "normal";
}

function clampFinancialKind(value: string): AIFinancialKind {
  return (FINANCIAL_KINDS as string[]).includes(value)
    ? (value as AIFinancialKind)
    : "other";
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Mapper de la sortie riche vers `AnalyzeResult` (compatibilité descendante
 * avec l'API d'analyse existante et avec `AIAnalysis`).
 *
 * Garde la richesse : `warnings` et `autoApplyEligible` sont attachés
 * séparément (cf. retour de `parseAndMap`) pour permettre aux callers de
 * propager la garde sans casser la signature de `AnalyzeResult`.
 */
export function mapToAnalyzeResult(rich: AIRichAnalysis): AnalyzeResult {
  const dates: AIDetectedDate[] = rich.dates.map((d) => ({
    label: d.label,
    iso: d.iso,
    date: d.date,
  }));

  const amounts: AIDetectedAmount[] = rich.amounts.map((a) => ({
    label: a.label,
    amount: a.amount,
    currency: a.currency ?? "EUR",
    kind: a.kind ?? undefined,
  }));

  const references: AIDetectedReference[] = rich.references.map((r) => ({
    label: r.label,
    value: r.value,
  }));

  const recommendedActions: AIRecommendedAction[] = rich.actions.map((action) => ({
    id: shortId(),
    type: clampAction(action.type),
    title: action.title,
    description: action.description ?? undefined,
    dueDate: action.dueDate ?? null,
    amount: action.amount ?? null,
    priority: action.priority,
  }));

  const overallConfidence: AIConfidence = bucketConfidence(rich.globalConfidence);

  const financialImpact: AIFinancialImpact[] = rich.financialImpact.hasImpact
    ? [
        {
          kind: clampFinancialKind(rich.financialImpact.kind),
          amount: rich.financialImpact.amount ?? 0,
          currency: rich.financialImpact.currency ?? "EUR",
          dueDate: rich.financialImpact.dueDate ?? null,
          creditor: rich.correspondent.name ?? undefined,
          category: rich.classification.paperlessDocumentType ?? undefined,
          confidence: bucketConfidence(rich.financialImpact.confidence),
        },
      ]
    : [];

  return {
    summary: rich.summary,
    plainLanguageExplanation: rich.plainLanguageExplanation ?? rich.summary,
    detectedDocumentKind: rich.documentKind,
    suggestedTitle: rich.suggestedTitle,
    titleConfidence: rich.titleConfidence,
    titleReason: rich.titleReason ?? null,
    suggestedCorrespondentName: rich.correspondent.name,
    secondaryCorrespondentNames: rich.correspondent.secondary ?? [],
    suggestedDocumentTypeName: rich.classification.paperlessDocumentType,
    suggestedTagNames: rich.classification.tags,
    detectedDates: dates,
    detectedAmounts: amounts,
    detectedReferences: references,
    detectedPeople: rich.people,
    detectedOrganizations: rich.organizations,
    urgency: clampUrgency(rich.urgency),
    recommendedActions,
    financialImpact,
    confidence: overallConfidence,
    globalConfidenceScore: rich.globalConfidence,
    suggestedFolderName: rich.classification.project ?? null,
    provider: "",
  };
}

/**
 * Validation + mapping en une étape. Si la sortie est invalide, on lève
 * une erreur contrôlée qui peut être attrapée par le fallback mock.
 */
export function parseAndMap(raw: string): {
  result: AnalyzeResult;
  rich: AIRichAnalysis;
  warnings: AIRichAnalysis["warnings"];
  autoApplyEligible: boolean;
} {
  const parsed = parseAiAnalysisResponse(raw);
  if (!parsed.ok) {
    throw parsed.error;
  }
  const autoApply = computeAutoApplyEligible(parsed.data);
  return {
    result: mapToAnalyzeResult(parsed.data),
    rich: parsed.data,
    warnings: parsed.data.warnings,
    autoApplyEligible: autoApply,
  };
}
