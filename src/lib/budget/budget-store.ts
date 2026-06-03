import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getBudgetDataDir } from "./storage";
import {
  BUDGET_DEFAULT_CATEGORIES,
  type BudgetCategory,
  type BudgetCategoryInput,
  type Debt,
  type DebtInput,
  type DebtPayment,
  type DueItem,
  type Expense,
  type ExpenseInput,
  type Revenue,
  type RevenueInput,
} from "./types";

const CATEGORIES_FILE = "categories.json";
const REVENUES_FILE = "revenues.json";
const EXPENSES_FILE = "expenses.json";
const DEBTS_FILE = "debts.json";

async function ensureDir() {
  await mkdir(getBudgetDataDir(), { recursive: true });
}

function dataPath(file: string) {
  return path.join(getBudgetDataDir(), file);
}

async function readFileJson<T>(file: string): Promise<T[]> {
  try {
    const raw = await readFile(dataPath(file), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeFileJson<T>(file: string, data: T[]) {
  await ensureDir();
  await writeFile(dataPath(file), JSON.stringify(data, null, 2), "utf8");
}

// ---------- Categories ----------

export async function listCategories(): Promise<BudgetCategory[]> {
  const items = await readFileJson<BudgetCategory>(CATEGORIES_FILE);
  if (items.length === 0) {
    const now = new Date().toISOString();
    const seeded: BudgetCategory[] = BUDGET_DEFAULT_CATEGORIES.map((entry) => ({
      ...entry,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    }));
    await writeFileJson(CATEGORIES_FILE, seeded);
    return seeded;
  }
  return items;
}

export async function createCategory(input: BudgetCategoryInput): Promise<BudgetCategory> {
  const all = await listCategories();
  const now = new Date().toISOString();
  const created: BudgetCategory = {
    id: randomUUID(),
    name: input.name ?? "Nouvelle catégorie",
    type: input.type ?? "expense",
    color: input.color ?? "#64748b",
    icon: input.icon ?? "Tag",
    monthlyBudget: input.monthlyBudget ?? 0,
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeFileJson(CATEGORIES_FILE, all);
  return created;
}

export async function updateCategory(
  id: string,
  input: BudgetCategoryInput,
): Promise<BudgetCategory | null> {
  const all = await listCategories();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  const next: BudgetCategory = { ...all[index], ...input, id: all[index].id, updatedAt: now };
  all[index] = next;
  await writeFileJson(CATEGORIES_FILE, all);
  return next;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const all = await listCategories();
  const next = all.filter((entry) => entry.id !== id);
  if (next.length === all.length) return false;
  await writeFileJson(CATEGORIES_FILE, next);
  return true;
}

// ---------- Revenues ----------

export async function listRevenues(): Promise<Revenue[]> {
  return readFileJson<Revenue>(REVENUES_FILE);
}

export async function createRevenue(input: RevenueInput): Promise<Revenue> {
  const all = await listRevenues();
  const now = new Date().toISOString();
  const created: Revenue = {
    id: randomUUID(),
    label: input.label ?? "Revenu",
    source: input.source ?? "autre",
    amount: input.amount ?? 0,
    currency: input.currency ?? "EUR",
    date: input.date ?? new Date().toISOString().slice(0, 10),
    recurrence: input.recurrence ?? "one-shot",
    category: input.category ?? null,
    documentId: input.documentId ?? null,
    projectId: input.projectId ?? null,
    status: input.status ?? "planned",
    notes: input.notes ?? "",
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeFileJson(REVENUES_FILE, all);
  return created;
}

export async function updateRevenue(id: string, input: RevenueInput): Promise<Revenue | null> {
  const all = await listRevenues();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  const next: Revenue = { ...all[index], ...input, id: all[index].id, updatedAt: now };
  all[index] = next;
  await writeFileJson(REVENUES_FILE, all);
  return next;
}

export async function deleteRevenue(id: string): Promise<boolean> {
  const all = await listRevenues();
  const next = all.filter((entry) => entry.id !== id);
  if (next.length === all.length) return false;
  await writeFileJson(REVENUES_FILE, next);
  return true;
}

// ---------- Expenses ----------

export async function listExpenses(): Promise<Expense[]> {
  return readFileJson<Expense>(EXPENSES_FILE);
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const all = await listExpenses();
  const now = new Date().toISOString();
  const created: Expense = {
    id: randomUUID(),
    label: input.label ?? "Dépense",
    payee: input.payee ?? "",
    amount: input.amount ?? 0,
    currency: input.currency ?? "EUR",
    date: input.date ?? new Date().toISOString().slice(0, 10),
    dueDate: input.dueDate ?? null,
    category: input.category ?? null,
    recurrence: input.recurrence ?? "one-shot",
    documentId: input.documentId ?? null,
    projectId: input.projectId ?? null,
    status: input.status ?? "planned",
    notes: input.notes ?? "",
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeFileJson(EXPENSES_FILE, all);
  return created;
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense | null> {
  const all = await listExpenses();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  const next: Expense = { ...all[index], ...input, id: all[index].id, updatedAt: now };
  all[index] = next;
  await writeFileJson(EXPENSES_FILE, all);
  return next;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const all = await listExpenses();
  const next = all.filter((entry) => entry.id !== id);
  if (next.length === all.length) return false;
  await writeFileJson(EXPENSES_FILE, next);
  return true;
}

// ---------- Debts ----------

export async function listDebts(): Promise<Debt[]> {
  return readFileJson<Debt>(DEBTS_FILE);
}

export async function getDebt(id: string): Promise<Debt | null> {
  const all = await listDebts();
  return all.find((entry) => entry.id === id) ?? null;
}

export async function createDebt(input: DebtInput): Promise<Debt> {
  const all = await listDebts();
  const now = new Date().toISOString();
  const initial = input.initialAmount ?? 0;
  const created: Debt = {
    id: randomUUID(),
    label: input.label ?? "Dette",
    creditor: input.creditor ?? "",
    initialAmount: initial,
    remainingAmount: input.remainingAmount ?? initial,
    currency: input.currency ?? "EUR",
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    endDate: input.endDate ?? null,
    monthlyPayment: input.monthlyPayment ?? null,
    status: input.status ?? "to-pay",
    priority: input.priority ?? "normal",
    documentIds: input.documentIds ?? [],
    projectId: input.projectId ?? null,
    notes: input.notes ?? "",
    payments: [],
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeFileJson(DEBTS_FILE, all);
  return created;
}

export async function updateDebt(id: string, input: DebtInput): Promise<Debt | null> {
  const all = await listDebts();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  const next: Debt = { ...all[index], ...input, id: all[index].id, updatedAt: now };
  all[index] = next;
  await writeFileJson(DEBTS_FILE, all);
  return next;
}

export async function addDebtPayment(
  id: string,
  payment: Omit<DebtPayment, "id">,
): Promise<Debt | null> {
  const all = await listDebts();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const newPayment: DebtPayment = { ...payment, id: randomUUID() };
  const debt = all[index];
  const newRemaining = Math.max(0, debt.remainingAmount - newPayment.amount);
  const next: Debt = {
    ...debt,
    remainingAmount: newRemaining,
    status: newRemaining === 0 ? "settled" : debt.status,
    payments: [...debt.payments, newPayment],
    updatedAt: new Date().toISOString(),
  };
  all[index] = next;
  await writeFileJson(DEBTS_FILE, all);
  return next;
}

export async function deleteDebt(id: string): Promise<boolean> {
  const all = await listDebts();
  const next = all.filter((entry) => entry.id !== id);
  if (next.length === all.length) return false;
  await writeFileJson(DEBTS_FILE, next);
  return true;
}

// ---------- Aggregates ----------

function inCurrentMonth(date: string | null): boolean {
  if (!date) return false;
  const now = new Date();
  const dt = new Date(date);
  return dt.getUTCFullYear() === now.getUTCFullYear() && dt.getUTCMonth() === now.getUTCMonth();
}

export async function buildOverview(): Promise<import("./types").BudgetOverview> {
  const [revenues, expenses, debts] = await Promise.all([
    listRevenues(),
    listExpenses(),
    listDebts(),
  ]);

  const now = new Date();
  const sevenDaysFromNow = Date.now() + 7 * 86_400_000;
  const month = now.toISOString().slice(0, 7);

  const revenuesPlanned = revenues
    .filter((entry) => inCurrentMonth(entry.date))
    .reduce((total, entry) => total + entry.amount, 0);
  const revenuesReceived = revenues
    .filter((entry) => entry.status === "received" && inCurrentMonth(entry.date))
    .reduce((total, entry) => total + entry.amount, 0);
  const expensesPlanned = expenses
    .filter((entry) => inCurrentMonth(entry.date))
    .reduce((total, entry) => total + entry.amount, 0);
  const expensesPaid = expenses
    .filter((entry) => entry.status === "paid" && inCurrentMonth(entry.date))
    .reduce((total, entry) => total + entry.amount, 0);
  const debtsOutstanding = debts
    .filter((entry) => entry.status !== "settled" && entry.status !== "cancelled")
    .reduce((total, entry) => total + entry.remainingAmount, 0);

  const upcoming7Days =
    expenses.filter(
      (entry) =>
        entry.dueDate &&
        new Date(entry.dueDate).getTime() <= sevenDaysFromNow &&
        new Date(entry.dueDate).getTime() >= Date.now() &&
        entry.status !== "paid" &&
        entry.status !== "cancelled",
    ).length +
    debts.filter(
      (entry) =>
        entry.dueDate &&
        new Date(entry.dueDate).getTime() <= sevenDaysFromNow &&
        new Date(entry.dueDate).getTime() >= Date.now() &&
        entry.status !== "settled" &&
        entry.status !== "cancelled",
    ).length;

  const overdueCount =
    expenses.filter(
      (entry) =>
        entry.dueDate &&
        new Date(entry.dueDate).getTime() < Date.now() &&
        entry.status !== "paid" &&
        entry.status !== "cancelled",
    ).length +
    debts.filter(
      (entry) =>
        entry.dueDate &&
        new Date(entry.dueDate).getTime() < Date.now() &&
        entry.status !== "settled" &&
        entry.status !== "cancelled",
    ).length;

  const cashEstimate = revenuesReceived - expensesPaid;

  return {
    month,
    revenuesPlanned,
    revenuesReceived,
    expensesPlanned,
    expensesPaid,
    debtsOutstanding,
    upcoming7Days,
    overdueCount,
    cashEstimate,
    unvalidatedDocuments: 0,
  };
}

export type BudgetForecast = {
  horizonDays: number;
  expectedRevenues: number;
  expectedExpenses: number;
  expectedDebts: number;
  cashScenario: number;
  dueItems: DueItem[];
};

export async function buildForecast(daysHorizon: number = 31): Promise<BudgetForecast> {
  const [revenues, expenses, dueItems] = await Promise.all([
    listRevenues(),
    listExpenses(),
    buildDueItems(daysHorizon),
  ]);

  const now = Date.now();
  const horizon = now + daysHorizon * 86_400_000;

  const expectedRevenues = revenues
    .filter((entry) => {
      const time = new Date(entry.date).getTime();
      return time >= now && time <= horizon;
    })
    .reduce((total, entry) => total + entry.amount, 0);

  const expectedExpenses = expenses
    .filter((entry) => {
      if (entry.status === "paid" || entry.status === "cancelled") return false;
      const time = new Date(entry.dueDate ?? entry.date).getTime();
      return time >= now && time <= horizon;
    })
    .reduce((total, entry) => total + entry.amount, 0);

  const expectedDebts = dueItems
    .filter((entry) => entry.kind === "debt")
    .reduce((total, entry) => total + (entry.amount ?? 0), 0);

  return {
    horizonDays: daysHorizon,
    expectedRevenues,
    expectedExpenses,
    expectedDebts,
    cashScenario: expectedRevenues - (expectedExpenses + expectedDebts),
    dueItems,
  };
}

export async function buildDueItems(daysHorizon: number = 30): Promise<DueItem[]> {
  const [expenses, debts] = await Promise.all([listExpenses(), listDebts()]);
  const cutoff = Date.now() + daysHorizon * 86_400_000;
  const items: DueItem[] = [];

  for (const expense of expenses) {
    if (!expense.dueDate) continue;
    const time = new Date(expense.dueDate).getTime();
    if (time > cutoff) continue;
    if (expense.status === "paid" || expense.status === "cancelled") continue;
    items.push({
      id: `expense-${expense.id}`,
      kind: "expense",
      refId: expense.id,
      label: expense.label,
      amount: expense.amount,
      currency: expense.currency,
      dueDate: expense.dueDate,
      status: time < Date.now() ? "overdue" : expense.status,
      documentIds: expense.documentId ? [expense.documentId] : [],
      projectId: expense.projectId,
    });
  }
  for (const debt of debts) {
    if (!debt.dueDate) continue;
    const time = new Date(debt.dueDate).getTime();
    if (time > cutoff) continue;
    if (debt.status === "settled" || debt.status === "cancelled") continue;
    items.push({
      id: `debt-${debt.id}`,
      kind: "debt",
      refId: debt.id,
      label: debt.label,
      amount: debt.remainingAmount,
      currency: debt.currency,
      dueDate: debt.dueDate,
      status: time < Date.now() ? "overdue" : "to-pay",
      documentIds: debt.documentIds,
      projectId: debt.projectId,
    });
  }
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
