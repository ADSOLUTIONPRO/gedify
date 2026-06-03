/**
 * Lettrage (reconciliation): rapprochement entre un FinancialItem (dépense/revenu/dette)
 * et un document Paperless ou une transaction bancaire. Modèle préparé "à connecter" —
 * aucune logique de matching automatique tant que le moteur n'est pas branché.
 */

export type ReconciliationMatchType =
  | "exact" // montant + correspondant + date proche
  | "fuzzy" // montant proche (tolérance %)
  | "manual"; // associé manuellement par l'utilisateur

export type ReconciliationStatus =
  | "suggested"
  | "confirmed"
  | "rejected";

export type BudgetReconciliation = {
  id: string;
  financialItemId: string;
  /** Either a Paperless document id OR a bank transaction id is set (mutually exclusive). */
  linkedDocumentId: number | null;
  linkedBankTransactionId: string | null;
  matchType: ReconciliationMatchType;
  status: ReconciliationStatus;
  /** Confidence 0..1 from the matching engine (null when manual). */
  score: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};
