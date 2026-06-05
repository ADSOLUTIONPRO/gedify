import "server-only";

import { listFinancialItems } from "@/lib/budget/financial-item-store";
import type { FinancialItem } from "@/lib/budget/financial-item-types";

/* ────────────────────────────────────────────────────────────────────────
   Rapport FINANCES (Partie 11) pour la Santé GED. LECTURE SEULE.
   Lignes à contrôler, sans document, sans échéance, en retard, créées par IA,
   validées, doublons possibles. Ne modifie rien.
   ──────────────────────────────────────────────────────────────────────── */

export type FinancesReport = {
  total: number;
  toReview: number;
  withoutDocument: number;
  withoutDueDate: number;
  overdue: number;
  aiCreated: number;
  validated: number;
  duplicateGroups: number;
  generatedAt: string;
};

const PAID_LIKE = new Set(["paid", "cancelled", "ignored"]);

/** Une ligne sortante est-elle « en retard » ? (échéance passée, non soldée) */
export function isOverdue(it: FinancialItem, todayIso: string): boolean {
  if (it.status === "overdue") return true;
  if (!it.dueDate) return false;
  if (PAID_LIKE.has(it.status)) return false;
  if (it.amountRemaining != null && it.amountRemaining <= 0) return false;
  return it.dueDate.slice(0, 10) < todayIso;
}

function dupKey(it: FinancialItem): string {
  return `${it.sourceDocumentId ?? "x"}|${it.kind}|${it.amount}|${it.dueDate ?? ""}|${it.correspondentId ?? ""}`;
}

export function summarizeFinances(items: FinancialItem[]): Omit<FinancesReport, "generatedAt"> {
  const todayIso = new Date().toISOString().slice(0, 10);
  let toReview = 0;
  let withoutDocument = 0;
  let withoutDueDate = 0;
  let overdue = 0;
  let aiCreated = 0;
  let validated = 0;
  const dupCounts = new Map<string, number>();

  for (const it of items) {
    if (it.validationStatus === "needs_review" || it.status === "to_review" || it.status === "suggested") toReview += 1;
    if (it.sourceDocumentId == null) withoutDocument += 1;
    if (it.direction === "outgoing" && !it.dueDate) withoutDueDate += 1;
    if (isOverdue(it, todayIso)) overdue += 1;
    if (it.isAiDetected) aiCreated += 1;
    if (it.validationStatus === "validated" || it.status === "validated") validated += 1;
    const k = dupKey(it);
    dupCounts.set(k, (dupCounts.get(k) ?? 0) + 1);
  }

  const duplicateGroups = [...dupCounts.values()].filter((n) => n > 1).length;
  return { total: items.length, toReview, withoutDocument, withoutDueDate, overdue, aiCreated, validated, duplicateGroups };
}

export async function computeFinancesReport(): Promise<FinancesReport> {
  const items = await listFinancialItems({});
  return { ...summarizeFinances(items), generatedAt: new Date().toISOString() };
}
