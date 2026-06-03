export type BudgetCategoryType = "revenue" | "expense" | "debt";

export type BudgetItemStatus =
  | "planned"
  | "to-pay"
  | "paid"
  | "received"
  | "overdue"
  | "contested"
  | "cancelled";

export type BudgetRecurrence =
  | "one-shot"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export type BudgetCategory = {
  id: string;
  name: string;
  type: BudgetCategoryType;
  color: string;
  icon: string;
  monthlyBudget: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BudgetCategoryInput = Partial<Omit<BudgetCategory, "id" | "createdAt" | "updatedAt">>;

export type Revenue = {
  id: string;
  label: string;
  source: string;
  amount: number;
  currency: string;
  date: string;
  recurrence: BudgetRecurrence;
  category: string | null;
  documentId: number | null;
  projectId: string | null;
  status: BudgetItemStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type RevenueInput = Partial<Omit<Revenue, "id" | "createdAt" | "updatedAt">>;

export type Expense = {
  id: string;
  label: string;
  payee: string;
  amount: number;
  currency: string;
  date: string;
  dueDate: string | null;
  category: string | null;
  recurrence: BudgetRecurrence;
  documentId: number | null;
  projectId: string | null;
  status: BudgetItemStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = Partial<Omit<Expense, "id" | "createdAt" | "updatedAt">>;

export type DebtStatus =
  | "to-pay"
  | "in-progress"
  | "schedule"
  | "overdue"
  | "contested"
  | "settled"
  | "cancelled";

export type Debt = {
  id: string;
  label: string;
  creditor: string;
  initialAmount: number;
  remainingAmount: number;
  currency: string;
  startDate: string | null;
  dueDate: string | null;
  endDate: string | null;
  monthlyPayment: number | null;
  status: DebtStatus;
  priority: "low" | "normal" | "high" | "urgent";
  documentIds: number[];
  projectId: string | null;
  notes: string;
  payments: DebtPayment[];
  createdAt: string;
  updatedAt: string;
};

export type DebtPayment = {
  id: string;
  date: string;
  amount: number;
  documentId: number | null;
  notes: string;
};

export type DebtInput = Partial<
  Omit<Debt, "id" | "payments" | "createdAt" | "updatedAt">
>;

export type DueItem = {
  id: string;
  kind: "expense" | "debt" | "action";
  refId: string | null;
  label: string;
  amount: number | null;
  currency: string | null;
  dueDate: string;
  status: BudgetItemStatus | "todo" | "overdue";
  documentIds: number[];
  projectId: string | null;
};

export type BudgetOverview = {
  month: string;
  revenuesPlanned: number;
  revenuesReceived: number;
  expensesPlanned: number;
  expensesPaid: number;
  debtsOutstanding: number;
  upcoming7Days: number;
  overdueCount: number;
  cashEstimate: number;
  unvalidatedDocuments: number;
};

export const BUDGET_DEFAULT_CATEGORIES: Omit<BudgetCategory, "id" | "createdAt" | "updatedAt">[] = [
  { name: "Logement", type: "expense", color: "#0ea5e9", icon: "Home", monthlyBudget: 0, active: true },
  { name: "Énergie", type: "expense", color: "#f59e0b", icon: "Zap", monthlyBudget: 0, active: true },
  { name: "Eau", type: "expense", color: "#22d3ee", icon: "Droplets", monthlyBudget: 0, active: true },
  { name: "Téléphone / Internet", type: "expense", color: "#6366f1", icon: "Wifi", monthlyBudget: 0, active: true },
  { name: "Assurance", type: "expense", color: "#8b5cf6", icon: "ShieldCheck", monthlyBudget: 0, active: true },
  { name: "Transport", type: "expense", color: "#14b8a6", icon: "Car", monthlyBudget: 0, active: true },
  { name: "Santé", type: "expense", color: "#ec4899", icon: "Heart", monthlyBudget: 0, active: true },
  { name: "Impôts", type: "expense", color: "#dc2626", icon: "Receipt", monthlyBudget: 0, active: true },
  { name: "Banque", type: "expense", color: "#64748b", icon: "Landmark", monthlyBudget: 0, active: true },
  { name: "Alimentation", type: "expense", color: "#10b981", icon: "ShoppingCart", monthlyBudget: 0, active: true },
  { name: "Enfants / Famille", type: "expense", color: "#f97316", icon: "Users", monthlyBudget: 0, active: true },
  { name: "Juridique", type: "expense", color: "#7c3aed", icon: "Scale", monthlyBudget: 0, active: true },
  { name: "Travaux", type: "expense", color: "#a855f7", icon: "Hammer", monthlyBudget: 0, active: true },
  { name: "Entreprise", type: "expense", color: "#475569", icon: "Briefcase", monthlyBudget: 0, active: true },
  { name: "Autre", type: "expense", color: "#94a3b8", icon: "Tag", monthlyBudget: 0, active: true },
  { name: "Salaire", type: "revenue", color: "#22c55e", icon: "Briefcase", monthlyBudget: 0, active: true },
  { name: "CAF", type: "revenue", color: "#06b6d4", icon: "Baby", monthlyBudget: 0, active: true },
  { name: "CPAM", type: "revenue", color: "#0284c7", icon: "Stethoscope", monthlyBudget: 0, active: true },
  { name: "Remboursement", type: "revenue", color: "#16a34a", icon: "ArrowDownLeft", monthlyBudget: 0, active: true },
  { name: "Aide sociale", type: "revenue", color: "#84cc16", icon: "HandCoins", monthlyBudget: 0, active: true },
];
