export type FinancialKind =
  | "revenue"
  | "expense"
  | "debt"
  | "due_payment"
  | "refund"
  | "credit"
  | "tax"
  | "fee"
  | "subscription"
  | "loan"
  | "installment"
  | "reimbursement"
  | "benefit"
  | "salary"
  | "allowance"
  | "penalty"
  | "disputed_amount"
  | "other";

export type FinancialDirection = "incoming" | "outgoing" | "neutral";

export type FinancialItemStatus =
  | "suggested"
  | "to_review"
  | "validated"
  | "ignored"
  | "paid"
  | "unpaid"
  | "upcoming_expense"
  | "overdue"
  | "partially_paid"
  | "disputed"
  | "cancelled"
  | "scheduled";

export type FinancialPaymentStatus =
  | "not_due"
  | "due_soon"
  | "due"
  | "overdue"
  | "paid"
  | "partial"
  | "unknown";

export type FinancialValidationStatus =
  | "pending"
  | "needs_review"
  | "validated"
  | "rejected"
  | "ignored";

export type FinancialRecurrence =
  | "one_shot"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export type FinancialItem = {
  id: string;

  // Source link
  sourceDocumentId: number | null;
  sourceDocumentTitle: string | null;
  sourcePaperlessUrl: string | null;
  sourceAnalysisId: string | null;

  // Classification
  kind: FinancialKind;
  direction: FinancialDirection;
  label: string;
  description: string;

  // Amounts
  amount: number;
  currency: string;
  taxAmount: number | null;
  amountWithoutTax: number | null;
  amountPaid: number;
  amountRemaining: number | null;

  // Dates
  documentDate: string | null;
  issueDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  /** "YYYY-MM" — chosen budget month. May differ from document/due date. */
  budgetMonth: string | null;
  /** "YYYY" — derived from budgetMonth when set. */
  budgetYear: string | null;

  // Relations
  correspondentId: number | null;
  correspondentName: string | null;
  projectId: string | null;
  projectName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  tags: number[];

  // Status
  status: FinancialItemStatus;
  paymentStatus: FinancialPaymentStatus;
  recurrence: FinancialRecurrence;
  recurrenceFrequency: number | null;

  // References (free text)
  reference: string | null;
  contractNumber: string | null;
  customerNumber: string | null;
  invoiceNumber: string | null;

  // AI provenance
  isAiDetected: boolean;
  aiConfidence: "low" | "medium" | "high" | null;
  aiProvider: string | null;
  validationStatus: FinancialValidationStatus;
  validatedAt: string | null;
  ignoredAt: string | null;

  // Misc
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type FinancialItemInput = Partial<
  Omit<FinancialItem, "id" | "createdAt" | "updatedAt">
>;

export const KIND_TO_DIRECTION: Record<FinancialKind, FinancialDirection> = {
  revenue: "incoming",
  refund: "incoming",
  reimbursement: "incoming",
  benefit: "incoming",
  salary: "incoming",
  allowance: "incoming",
  expense: "outgoing",
  debt: "outgoing",
  due_payment: "outgoing",
  credit: "outgoing",
  tax: "outgoing",
  fee: "outgoing",
  subscription: "outgoing",
  loan: "outgoing",
  installment: "outgoing",
  penalty: "outgoing",
  disputed_amount: "neutral",
  other: "neutral",
};

export const KIND_LABELS: Record<FinancialKind, string> = {
  revenue: "Revenu",
  expense: "Dépense",
  debt: "Dette",
  due_payment: "Paiement à faire",
  refund: "Remboursement",
  credit: "Crédit",
  tax: "Impôt / Taxe",
  fee: "Frais",
  subscription: "Abonnement",
  loan: "Prêt",
  installment: "Échéancier",
  reimbursement: "Remboursement reçu",
  benefit: "Aide / Allocation",
  salary: "Salaire",
  allowance: "Allocation",
  penalty: "Pénalité",
  disputed_amount: "Montant contesté",
  other: "Autre",
};

export const STATUS_LABELS: Record<FinancialItemStatus, string> = {
  suggested: "Suggéré",
  to_review: "À contrôler",
  validated: "Validé",
  ignored: "Ignoré",
  paid: "Payé",
  unpaid: "À payer",
  upcoming_expense: "Dépense à venir",
  overdue: "En retard",
  partially_paid: "Partiellement payé",
  disputed: "Contesté",
  cancelled: "Annulé",
  scheduled: "Programmé",
};

export const PAYMENT_STATUS_LABELS: Record<FinancialPaymentStatus, string> = {
  not_due: "Pas encore dû",
  due_soon: "Bientôt dû",
  due: "Dû",
  overdue: "En retard",
  paid: "Payé",
  partial: "Partiel",
  unknown: "Inconnu",
};
