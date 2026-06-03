import "server-only";

import type { AIAnalysis, AIFinancialImpact, AIFinancialKind } from "@/lib/ai/types";
import { toBudgetMonth } from "./budget-periods";
import {
  KIND_TO_DIRECTION,
  type FinancialItemInput,
  type FinancialItemStatus,
  type FinancialKind,
} from "./financial-item-types";

/** Statut dérivé d'un impact financier (date d'échéance + paiement). */
function deriveStatus(kind: FinancialKind, dueDate: string | null, paidDate: string | null | undefined): FinancialItemStatus {
  if (paidDate) return "paid";
  const outgoing = KIND_TO_DIRECTION[kind] === "outgoing";
  if (dueDate) {
    const t = Date.parse(dueDate);
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    if (!Number.isNaN(t)) {
      if (t < startOfToday.getTime()) return "overdue";
      if (t > Date.now() && outgoing) return "upcoming_expense";
    }
  }
  return "unpaid";
}

const KIND_MAP: Record<AIFinancialKind, FinancialKind> = {
  income: "revenue",
  expense: "expense",
  debt: "debt",
  refund: "refund",
  invoice: "expense",
  subscription: "subscription",
  due: "due_payment",
  allowance: "allowance",
  benefit: "benefit",
  tax: "tax",
  credit: "credit",
  loan: "loan",
  fees: "fee",
  other: "other",
};

/**
 * Transforms an AI-detected financial impact into a FinancialItemInput candidate.
 * The caller is responsible for asking the user to validate/modify before persistence.
 */
export function mapImpactToCandidate(
  analysis: Pick<
    AIAnalysis,
    | "id"
    | "documentId"
    | "summary"
    | "detectedDocumentKind"
    | "suggestedCorrespondentId"
    | "suggestedCorrespondentName"
    | "confidence"
    | "provider"
    | "detectedDates"
  >,
  impact: AIFinancialImpact,
  options: { paperlessBaseUrl?: string | null; documentTitle?: string | null } = {},
): FinancialItemInput {
  const kind = KIND_MAP[impact.kind] ?? "other";
  const documentDate = analysis.detectedDates.find((d) => /date|émission|document/i.test(d.label))?.iso ?? null;
  const dueDate = impact.dueDate ?? analysis.detectedDates.find((d) => /échéance|limite|paiement/i.test(d.label))?.iso ?? null;
  const budgetMonth =
    toBudgetMonth(dueDate) ?? toBudgetMonth(documentDate) ?? toBudgetMonth(new Date());

  const labelBase = analysis.detectedDocumentKind || "Élément financier";
  const label = impact.creditor ? `${labelBase} · ${impact.creditor}` : labelBase;

  // §19 — statut cohérent dérivé (jamais « à contrôler » par défaut) ; on ne
  // marque « à contrôler » (needs_review) que si la confiance est faible.
  const status = deriveStatus(kind, dueDate, impact.paidDate ?? null);
  const confidence = impact.confidence ?? analysis.confidence;
  const needsReview = confidence === "low";

  return {
    sourceDocumentId: analysis.documentId,
    sourceDocumentTitle: options.documentTitle ?? null,
    sourcePaperlessUrl: options.paperlessBaseUrl
      ? `${options.paperlessBaseUrl}/documents/${analysis.documentId}`
      : null,
    sourceAnalysisId: analysis.id,
    kind,
    label,
    description: analysis.summary.slice(0, 200),
    amount: impact.amount,
    currency: impact.currency || "EUR",
    documentDate,
    dueDate,
    budgetMonth,
    correspondentId: analysis.suggestedCorrespondentId,
    correspondentName: impact.creditor ?? analysis.suggestedCorrespondentName ?? null,
    categoryName: impact.category ?? null,
    reference: impact.reference ?? null,
    recurrence: impact.recurrence === "monthly" ? "monthly" : impact.recurrence === "yearly" ? "yearly" : "one_shot",
    isAiDetected: true,
    aiConfidence: confidence,
    aiProvider: analysis.provider ?? null,
    validationStatus: needsReview ? "needs_review" : "pending",
    status,
    paymentStatus: dueDate ? "unknown" : "not_due",
    notes: "",
  };
}
