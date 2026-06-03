import "server-only";

import { z } from "zod";
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

// ─── Zod schema matching the flat ANALYSIS_OUTPUT_SCHEMA from the prompt ──────
// Lenient: optional fields, defaults, coercion — handles small-model output.

const FlatDateSchema = z.object({
  label: z.string().default("Date"),
  date: z.string().default("01/01/2000"),
  iso: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default("2000-01-01"),
});

const FlatAmountSchema = z.object({
  label: z.string().default("Montant"),
  amount: z.coerce.number().finite(),
  currency: z.string().default("EUR"),
  kind: z.string().nullable().optional(),
});

const FlatReferenceSchema = z.object({
  label: z.string().default("Référence"),
  value: z.string().min(1),
});

const ACTION_TYPES: AIRecommendedActionType[] = [
  "pay", "reply", "forward", "verify", "classify", "follow-up", "sign",
  "send", "keep", "archive", "call", "prepare", "declare", "contest",
];
const URGENCY_VALUES: AIUrgency[] = ["info", "normal", "important", "urgent"];
const FINANCIAL_KINDS: AIFinancialKind[] = [
  "income", "expense", "debt", "refund", "invoice", "subscription", "due",
  "allowance", "benefit", "tax", "credit", "loan", "fees", "other",
];

function clampAction(v: string): AIRecommendedActionType {
  return (ACTION_TYPES as string[]).includes(v)
    ? (v as AIRecommendedActionType)
    : "classify";
}
function clampUrgency(v: string): AIUrgency {
  return (URGENCY_VALUES as string[]).includes(v)
    ? (v as AIUrgency)
    : "normal";
}
function clampFinancialKind(v: string): AIFinancialKind {
  return (FINANCIAL_KINDS as string[]).includes(v)
    ? (v as AIFinancialKind)
    : "other";
}
function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const FlatActionSchema = z.object({
  type: z.string().default("classify"),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  amount: z.coerce.number().finite().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

const FlatFinancialImpactSchema = z.object({
  kind: z.string().default("other"),
  amount: z.coerce.number().finite().nullable().optional(),
  currency: z.string().default("EUR"),
  dueDate: z.string().nullable().optional(),
  creditor: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  recurrence: z.string().nullable().optional(),
});

const FlatAnalysisSchema = z.object({
  summary: z.string().min(1),
  plainLanguageExplanation: z.string().nullable().optional(),
  detectedDocumentKind: z.string().default("Document"),
  suggestedTitle: z.string().min(1),
  titleConfidence: z.coerce.number().min(0).max(1).default(0.5),
  titleReason: z.string().nullable().optional(),
  suggestedCorrespondentName: z.string().nullable().optional(),
  suggestedDocumentTypeName: z.string().nullable().optional(),
  suggestedTagNames: z.array(z.string()).default([]),
  detectedDates: z.array(FlatDateSchema).default([]),
  detectedAmounts: z.array(FlatAmountSchema).default([]),
  detectedReferences: z.array(FlatReferenceSchema).default([]),
  detectedPeople: z.array(z.string()).default([]),
  detectedOrganizations: z.array(z.string()).default([]),
  urgency: z.string().default("normal"),
  recommendedActions: z.array(FlatActionSchema).default([]),
  financialImpact: z.union([
    z.array(FlatFinancialImpactSchema),
    z.object({}).passthrough().transform(() => []),
  ]).default([]),
  confidence: z.enum(["low", "medium", "high"]).default("low"),
});

type FlatAnalysis = z.infer<typeof FlatAnalysisSchema>;

export class AIFlatParseError extends Error {
  readonly rawSnippet: string;
  readonly parseError: string;

  constructor(message: string, raw: string, parseError: string) {
    super(message);
    this.name = "AIFlatParseError";
    this.rawSnippet = raw.slice(0, 600);
    this.parseError = parseError;
  }
}

/**
 * Extracts the first JSON object found in a string.
 * Handles cases where the model adds text before/after the JSON.
 */
function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  if (start === -1) return raw;
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return raw.slice(start);
}

function mapFlat(flat: FlatAnalysis): AnalyzeResult {
  const dates: AIDetectedDate[] = flat.detectedDates.map((d) => ({
    label: d.label,
    date: d.date,
    iso: d.iso,
  }));

  const amounts: AIDetectedAmount[] = flat.detectedAmounts.map((a) => ({
    label: a.label,
    amount: a.amount,
    currency: a.currency ?? "EUR",
    kind: a.kind ?? undefined,
  }));

  const references: AIDetectedReference[] = flat.detectedReferences.map((r) => ({
    label: r.label,
    value: r.value,
  }));

  const actions: AIRecommendedAction[] = (flat.recommendedActions ?? []).map((a) => ({
    id: shortId(),
    type: clampAction(a.type),
    title: a.title,
    description: a.description ?? undefined,
    dueDate: a.dueDate ?? null,
    amount: a.amount ?? null,
    priority: a.priority,
  }));

  const impactArray = Array.isArray(flat.financialImpact) ? flat.financialImpact : [];
  const financialImpact: AIFinancialImpact[] = impactArray
    .filter((fi) => typeof fi.amount === "number" && fi.amount > 0)
    .map((fi) => ({
      kind: clampFinancialKind(fi.kind),
      amount: fi.amount!,
      currency: fi.currency ?? "EUR",
      dueDate: fi.dueDate ?? null,
      creditor: fi.creditor ?? undefined,
      category: fi.category ?? undefined,
      confidence: flat.confidence as AIConfidence,
    }));

  return {
    summary: flat.summary,
    plainLanguageExplanation: flat.plainLanguageExplanation ?? flat.summary,
    detectedDocumentKind: flat.detectedDocumentKind,
    suggestedTitle: flat.suggestedTitle,
    titleConfidence: flat.titleConfidence,
    titleReason: flat.titleReason ?? null,
    suggestedCorrespondentName: flat.suggestedCorrespondentName ?? null,
    suggestedDocumentTypeName: flat.suggestedDocumentTypeName ?? null,
    suggestedTagNames: flat.suggestedTagNames,
    detectedDates: dates,
    detectedAmounts: amounts,
    detectedReferences: references,
    detectedPeople: flat.detectedPeople,
    detectedOrganizations: flat.detectedOrganizations,
    urgency: clampUrgency(flat.urgency),
    recommendedActions: actions,
    financialImpact,
    confidence: flat.confidence,
    provider: "",
    warnings: [],
    autoApplyEligible: false,
  };
}

/**
 * Parses a flat JSON string from Ollama/legacy models and maps it to AnalyzeResult.
 * Throws AIFlatParseError if parsing fails — never falls back to mock.
 */
export function parseAndMapFlat(raw: string): AnalyzeResult {
  if (!raw || raw.trim().length === 0) {
    throw new AIFlatParseError("Réponse Ollama vide.", "", "empty");
  }

  const jsonStr = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new AIFlatParseError(
      "Réponse Ollama non-JSON. Aucune analyse disponible.",
      raw,
      e instanceof Error ? e.message : String(e)
    );
  }

  const result = FlatAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(" | ");
    throw new AIFlatParseError(
      `Réponse Ollama invalide vs schéma flat (${result.error.issues.length} erreur(s)). ${issues}`,
      raw,
      issues
    );
  }

  return mapFlat(result.data);
}
