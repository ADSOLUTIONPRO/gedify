import type {
  FinancialItemStatus,
  FinancialKind,
  FinancialPaymentStatus,
} from "@/lib/budget/financial-item-types";

export type Tone = "blue" | "violet" | "emerald" | "amber" | "rose" | "slate" | "orange";

export function formatAmount(amount: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toLocaleString("fr-FR")} ${currency}`;
  }
}

export const KIND_LABEL: Record<FinancialKind, string> = {
  revenue: "Revenu",
  expense: "Dépense",
  debt: "Dette",
  due_payment: "Échéance",
  refund: "Remboursement",
  credit: "Crédit",
  tax: "Impôt",
  fee: "Frais",
  subscription: "Abonnement",
  loan: "Prêt",
  installment: "Mensualité",
  reimbursement: "Remboursement",
  benefit: "Prestation",
  salary: "Salaire",
  allowance: "Allocation",
  penalty: "Pénalité",
  disputed_amount: "Montant contesté",
  other: "Autre",
};

export const STATUS_META: Record<FinancialItemStatus, { label: string; tone: Tone }> = {
  suggested: { label: "Suggéré", tone: "violet" },
  to_review: { label: "À contrôler", tone: "amber" },
  validated: { label: "Validé", tone: "emerald" },
  ignored: { label: "Rejeté", tone: "slate" },
  paid: { label: "Payé", tone: "emerald" },
  unpaid: { label: "Non payé", tone: "orange" },
  upcoming_expense: { label: "Dépense à venir", tone: "blue" },
  overdue: { label: "En retard", tone: "rose" },
  partially_paid: { label: "Partiel", tone: "amber" },
  disputed: { label: "Contesté", tone: "rose" },
  cancelled: { label: "Annulé", tone: "slate" },
  scheduled: { label: "Planifié", tone: "blue" },
};

export const PAYMENT_STATUS_META: Record<FinancialPaymentStatus, { label: string; tone: Tone }> = {
  not_due: { label: "Non échu", tone: "slate" },
  due_soon: { label: "Bientôt", tone: "amber" },
  due: { label: "À payer", tone: "orange" },
  overdue: { label: "En retard", tone: "rose" },
  paid: { label: "Payé", tone: "emerald" },
  partial: { label: "Partiel", tone: "amber" },
  unknown: { label: "—", tone: "slate" },
};
