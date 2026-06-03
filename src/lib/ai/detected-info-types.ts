export type DetectedInfoKind =
  | "amount"
  | "due_date"
  | "document_date"
  | "payment_date"
  | "period_start"
  | "period_end"
  | "reference"
  | "invoice_number"
  | "customer_number"
  | "contract_number"
  | "organization"
  | "person"
  | "correspondent"
  | "financial_type"
  | "category"
  | "payment_status"
  | "budget_month"
  | "budget_year"
  | "note"
  | "other";

export type DetectedInfoStatus =
  | "detected"
  | "edited"
  | "validated"
  | "ignored"
  | "converted_to_budget"
  | "converted_to_action"
  | "converted_to_debt"
  | "converted_to_due_item";

export type DetectedInfoSource = "ai" | "user" | "paperless" | "email" | "workflow";

export type DetectedInfo = {
  id: string;
  sourceDocumentId: number | null;
  sourceAnalysisId: string | null;

  kind: DetectedInfoKind;
  label: string;
  /** Human-readable rendering of the value. */
  value: string;
  /** Lower-cased / trimmed version used for comparisons. */
  normalizedValue: string;

  // Typed values (only one is set depending on kind)
  amount: number | null;
  currency: string | null;
  dateValue: string | null;
  textValue: string | null;
  referenceValue: string | null;

  confidence: "low" | "medium" | "high" | null;
  status: DetectedInfoStatus;
  source: DetectedInfoSource;
  /** Free-form key used by callers to group detections (e.g. "amount-1", "due-date"). */
  fieldKey: string | null;

  // Relations
  correspondentId: number | null;
  correspondentName: string | null;
  projectId: string | null;
  projectName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  financialItemId: string | null;
  actionId: string | null;

  // Edit history
  isEdited: boolean;
  editedBy: string | null;
  editedAt: string | null;
  /** Captured the first time the user changes `value`. */
  originalValue: string | null;

  createdAt: string;
  updatedAt: string;
};

export type DetectedInfoInput = Partial<
  Omit<DetectedInfo, "id" | "createdAt" | "updatedAt">
>;

export const DETECTED_KIND_LABEL: Record<DetectedInfoKind, string> = {
  amount: "Montant",
  due_date: "Date d'échéance",
  document_date: "Date du document",
  payment_date: "Date de paiement",
  period_start: "Début de période",
  period_end: "Fin de période",
  reference: "Référence",
  invoice_number: "N° facture",
  customer_number: "N° client",
  contract_number: "N° contrat",
  organization: "Organisme",
  person: "Personne",
  correspondent: "Correspondant",
  financial_type: "Type financier",
  category: "Catégorie",
  payment_status: "Statut paiement",
  budget_month: "Mois budgétaire",
  budget_year: "Année budgétaire",
  note: "Note",
  other: "Autre",
};

export const DETECTED_STATUS_LABEL: Record<DetectedInfoStatus, string> = {
  detected: "Détectée",
  edited: "Modifiée",
  validated: "Validée",
  ignored: "Ignorée",
  converted_to_budget: "→ Budget",
  converted_to_action: "→ Action",
  converted_to_debt: "→ Dette",
  converted_to_due_item: "→ Échéance",
};
