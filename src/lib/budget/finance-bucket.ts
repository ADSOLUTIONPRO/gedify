import "server-only";

import type { FinancialItem } from "./financial-item-types";

/**
 * Source de vérité UNIQUE pour la catégorie financière (§2-5).
 *
 * Chaque ligne possède AU PLUS UNE catégorie principale exclusive. Fini le
 * triple comptage (une facture impayée échue comptée en Dépenses + Dettes +
 * En retard) : `resolveFinanceBucket` renvoie exactement un bucket (ou null
 * pour une ligne inactive/supprimée/rejetée).
 *
 * Priorité (déterministe) :
 *   1. to_review  — non validé / à contrôler (suggestions IA incluses, §19)
 *   2. income     — toute ligne entrante (revenu / à encaisser)
 *   3. expense    — sortie réglée (payée)
 *   4. overdue    — sortie due, échéance dépassée
 *   5. due_soon   — sortie due, échéance dans la fenêtre (30 j)
 *   6. debt       — sortie due, sans échéance proche ni dépassée
 */

export type FinanceBucket = "income" | "expense" | "debt" | "due_soon" | "overdue" | "to_review";

export const FINANCE_BUCKETS: FinanceBucket[] = ["income", "expense", "debt", "due_soon", "overdue", "to_review"];

const DUE_SOON_WINDOW_MS = 30 * 86_400_000;

/** Ligne inactive : exclue de tous les compteurs (0 catégorie). */
function isInactive(item: FinancialItem): boolean {
  return (
    item.status === "cancelled" ||
    item.status === "ignored" ||
    item.validationStatus === "rejected" ||
    item.validationStatus === "ignored"
  );
}

/** À contrôler : suggestion IA non validée / validation requise. */
function isToReview(item: FinancialItem): boolean {
  return item.status === "suggested" || item.status === "to_review" || item.validationStatus === "needs_review";
}

function isPaid(item: FinancialItem): boolean {
  return item.status === "paid" || item.paymentStatus === "paid";
}

/** Catégorie principale EXCLUSIVE d'une ligne (ou null si inactive). */
export function resolveFinanceBucket(item: FinancialItem, now: number = Date.now()): FinanceBucket | null {
  if (isInactive(item)) return null;
  if (isToReview(item)) return "to_review";
  if (item.direction === "incoming") return "income";

  // Sortie (dépense / dette) :
  if (isPaid(item)) return "expense";

  const due = item.dueDate ? new Date(item.dueDate).getTime() : null;
  if (due !== null && Number.isFinite(due)) {
    if (due < now) return "overdue";
    if (due <= now + DUE_SOON_WINDOW_MS) return "due_soon";
  }
  // Repli sur le statut de paiement si la date est absente/ambiguë.
  if (item.paymentStatus === "overdue") return "overdue";
  if (item.paymentStatus === "due_soon" || item.paymentStatus === "due") return "due_soon";
  return "debt";
}

/** Montant comptabilisé : restant dû pour debt/due_soon/overdue, sinon montant. */
export function bucketAmount(item: FinancialItem, bucket: FinanceBucket | null): number {
  if (bucket === "debt" || bucket === "due_soon" || bucket === "overdue") {
    return item.amountRemaining ?? Math.max(0, item.amount - (item.amountPaid ?? 0));
  }
  return item.amount;
}

export type FinanceAggregate = { count: number; total: number };
export type FinanceAggregates = {
  income: FinanceAggregate;
  expense: FinanceAggregate;
  debt: FinanceAggregate;
  dueSoon: FinanceAggregate;
  overdue: FinanceAggregate;
  toReview: FinanceAggregate;
  netBalance: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Agrège une liste de lignes : chaque id n'apparaît que dans UN seul bucket. */
export function aggregateFinances(items: FinancialItem[], now: number = Date.now()): FinanceAggregates {
  const z = (): FinanceAggregate => ({ count: 0, total: 0 });
  const agg = { income: z(), expense: z(), debt: z(), dueSoon: z(), overdue: z(), toReview: z() };
  const cell: Record<FinanceBucket, FinanceAggregate> = {
    income: agg.income, expense: agg.expense, debt: agg.debt,
    due_soon: agg.dueSoon, overdue: agg.overdue, to_review: agg.toReview,
  };
  for (const item of items) {
    const b = resolveFinanceBucket(item, now);
    if (!b) continue;
    cell[b].count += 1;
    cell[b].total += bucketAmount(item, b);
  }
  for (const k of Object.keys(cell) as FinanceBucket[]) cell[k].total = round2(cell[k].total);
  return { ...agg, netBalance: round2(agg.income.total - agg.expense.total) };
}

/** Lignes appartenant à un bucket précis (carte == page). */
export function filterByBucket(items: FinancialItem[], bucket: FinanceBucket, now: number = Date.now()): FinancialItem[] {
  return items.filter((i) => resolveFinanceBucket(i, now) === bucket);
}
