import type { FinancialItem, FinancialItemInput, FinancialItemStatus, FinancialKind } from "./financial-item-types";

/**
 * Couche « type principal » UNIQUE au-dessus du modèle riche (kind/status…).
 * Garantit qu'une ligne n'a qu'un seul type métier (§11), avec un statut séparé
 * et un classement temporel dérivé de l'échéance (§12). Module pur (client-safe).
 */

export type PrincipalType =
  | "revenu"
  | "depense"
  | "depense_a_venir"
  | "dette"
  | "remboursement"
  | "avoir"
  | "echeancier"
  | "autre";

export const PRINCIPAL_LABELS: Record<PrincipalType, string> = {
  revenu: "Revenu",
  depense: "Dépense",
  depense_a_venir: "Dépense à venir",
  dette: "Dette",
  remboursement: "Remboursement",
  avoir: "Avoir",
  echeancier: "Échéancier",
  autre: "Autre",
};

/** Ordre d'affichage dans les sélecteurs de type. */
export const PRINCIPAL_ORDER: PrincipalType[] = [
  "depense", "depense_a_venir", "dette", "echeancier", "revenu", "remboursement", "avoir", "autre",
];

function remainingOf(item: Pick<FinancialItem, "amount" | "amountPaid" | "amountRemaining">): number {
  return item.amountRemaining ?? Math.max(0, item.amount - item.amountPaid);
}

function isFutureDue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return Date.parse(dueDate) > Date.now();
}

/** Type principal UNIQUE dérivé du `kind` (+ statut/échéance pour « dépense à venir »). */
export function getPrincipalType(item: FinancialItem): PrincipalType {
  switch (item.kind) {
    case "debt": return "dette";
    case "refund":
    case "reimbursement": return "remboursement";
    case "credit": return "avoir";
    case "installment": return "echeancier";
    case "revenue":
    case "salary":
    case "benefit":
    case "allowance": return "revenu";
    case "other": return "autre";
    default: {
      // famille dépense (expense/subscription/tax/fee/loan/penalty/due_payment)
      const unpaid = item.status !== "paid" && remainingOf(item) > 0;
      if (item.status === "upcoming_expense" || (unpaid && isFutureDue(item.dueDate))) return "depense_a_venir";
      return "depense";
    }
  }
}

/** Patch à appliquer quand l'utilisateur change le type principal d'une ligne. */
export function applyPrincipalType(type: PrincipalType): FinancialItemInput {
  switch (type) {
    case "revenu": return { kind: "revenue" };
    case "depense": return { kind: "expense" };
    case "depense_a_venir": return { kind: "expense", status: "upcoming_expense" };
    case "dette": return { kind: "debt" };
    case "remboursement": return { kind: "refund" };
    case "avoir": return { kind: "credit" };
    case "echeancier": return { kind: "installment" };
    case "autre": return { kind: "other" };
  }
}

/* ── Classement temporel (§12) ───────────────────────────────────────────── */

export type TemporalBucket = "overdue" | "this_week" | "this_month" | "later" | "undated";

export const TEMPORAL_LABELS: Record<TemporalBucket, string> = {
  overdue: "En retard",
  this_week: "À payer bientôt",
  this_month: "30 prochains jours",
  later: "Plus tard",
  undated: "Sans date à traiter",
};

/** Bucket temporel d'une ligne selon son échéance + reste dû. */
export function temporalBucket(item: FinancialItem): TemporalBucket {
  if (!item.dueDate) return "undated";
  const t = Date.parse(item.dueDate);
  if (Number.isNaN(t)) return "undated";
  const now = Date.now();
  const remaining = remainingOf(item);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  if (t < startOfToday.getTime() && remaining > 0) return "overdue";
  if (t <= now + 7 * 86_400_000) return "this_week";
  if (t <= now + 30 * 86_400_000) return "this_month";
  return "later";
}

/* ── Statut d'affichage contextuel (§11) ─────────────────────────────────── */

export type DisplayTone = "emerald" | "amber" | "rose" | "slate" | "orange" | "blue" | "violet";

export type DisplayStatus = { label: string; tone: DisplayTone };

/** Statut lisible contextuel (à encaisser/encaissé vs à payer/payé), un seul. */
export function getDisplayStatus(item: FinancialItem): DisplayStatus {
  const incoming = item.direction === "incoming";
  if (item.validationStatus === "needs_review" || item.status === "to_review" || item.status === "suggested") {
    return { label: "À contrôler", tone: "violet" };
  }
  if (item.validationStatus === "ignored" || item.status === "ignored" || item.status === "cancelled") {
    return { label: "Ignoré", tone: "slate" };
  }
  if (item.validationStatus === "rejected") return { label: "Rejeté", tone: "slate" };
  const remaining = remainingOf(item);
  if (item.status === "paid" || (remaining <= 0 && item.amountPaid > 0)) {
    return { label: incoming ? "Encaissé" : "Payé", tone: "emerald" };
  }
  if (item.status === "disputed") return { label: "À régulariser", tone: "amber" };
  if (item.status === "partially_paid") return { label: "Partiel", tone: "amber" };
  if (item.status === "overdue" || item.paymentStatus === "overdue") return { label: "En retard", tone: "rose" };
  if (item.status === "upcoming_expense") return { label: "Dépense à venir", tone: "blue" };
  return { label: incoming ? "À encaisser" : "À payer", tone: "orange" };
}

/** Choix de statut éditables (mappés vers les champs du store), libellés contextuels. */
export function statusChoices(direction: FinancialItem["direction"]): { value: FinancialItemStatus; label: string }[] {
  const incoming = direction === "incoming";
  return [
    { value: "to_review", label: "À contrôler" },
    { value: "unpaid", label: incoming ? "À encaisser" : "À payer" },
    { value: "upcoming_expense", label: "Dépense à venir" },
    { value: "paid", label: incoming ? "Encaissé" : "Payé" },
    { value: "partially_paid", label: "Partiel" },
    { value: "overdue", label: "En retard" },
    { value: "disputed", label: "À régulariser" },
    { value: "scheduled", label: "Programmé" },
    { value: "validated", label: "Validé" },
    { value: "ignored", label: "Ignoré" },
  ];
}

/** Couleur d'accent par type principal (cartes / badges). */
export const PRINCIPAL_COLOR: Record<PrincipalType, string> = {
  revenu: "#16A34A",
  depense: "#0B5CFF",
  depense_a_venir: "#6366F1",
  dette: "#F97316",
  remboursement: "#0EA5E9",
  avoir: "#14B8A6",
  echeancier: "#8B5CF6",
  autre: "#64748B",
};

/** Mappe un kind vers le type principal (pour agrégats côté serveur). */
export function principalTypeOfKind(kind: FinancialKind): PrincipalType {
  return getPrincipalType({ kind, status: "suggested", amount: 0, amountPaid: 0, amountRemaining: 0, dueDate: null, direction: "neutral" } as FinancialItem);
}
