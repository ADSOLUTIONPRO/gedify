/**
 * Prévisionnel budgétaire (BudgetPlan): scénario "ce que je prévois pour ce mois".
 * Comparé au réalisé via les FinancialItem validés sur la même période.
 *
 * Modèle stub "à connecter" — pas encore de persistance dédiée; sera branché plus tard.
 */

export type BudgetPlanLineKind = "revenue" | "expense" | "debt" | "savings" | "other";

export type BudgetPlanLine = {
  id: string;
  kind: BudgetPlanLineKind;
  label: string;
  categoryId: string | null;
  correspondentId: number | null;
  /** Montant prévu (toujours positif). La direction est portée par `kind`. */
  amount: number;
  currency: string;
  notes: string;
};

export type BudgetPlan = {
  id: string;
  /** Plan mensuel: "YYYY-MM". */
  budgetMonth: string;
  /** Plan annuel: "YYYY". Si défini, budgetMonth peut rester null. */
  budgetYear: string | null;
  label: string;
  lines: BudgetPlanLine[];
  createdAt: string;
  updatedAt: string;
};
