/**
 * Connecteur bancaire — modèle stub. Aucun connecteur réel n'est branché.
 * Affiché côté UI avec un bandeau "À connecter (PSD2 / agrégation)".
 */

export type BankAccountKind = "checking" | "savings" | "credit_card" | "loan" | "other";

export type BankAccount = {
  id: string;
  label: string;
  iban: string | null;
  /** Provider d'agrégation (Bridge, Powens, Tink, etc.) ou "manual". */
  provider: string;
  /** Identifiant interne au provider — null pour les comptes manuels. */
  providerAccountId: string | null;
  kind: BankAccountKind;
  currency: string;
  balance: number | null;
  balanceAt: string | null;
  status: "connected" | "disconnected" | "pending" | "error";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type BankTransaction = {
  id: string;
  bankAccountId: string;
  /** Date opération comptable. */
  date: string;
  /** Date valeur (peut différer). */
  valueDate: string | null;
  /** Montant signé (+ crédit, - débit). */
  amount: number;
  currency: string;
  /** Libellé brut tel que renvoyé par la banque. */
  rawLabel: string;
  /** Libellé nettoyé / catégorisé. */
  label: string;
  category: string | null;
  /** ID du FinancialItem lettré (cf. BudgetReconciliation). */
  linkedFinancialItemId: string | null;
  /** ID du document Paperless lettré. */
  linkedDocumentId: number | null;
  createdAt: string;
};
