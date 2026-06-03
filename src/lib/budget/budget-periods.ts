/**
 * Helpers for the budget period model. `budgetMonth` is stored as "YYYY-MM" so it can be
 * compared lexicographically — convenient for filtering by month, range, year.
 */

export function toBudgetMonth(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return null;
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function toBudgetYear(budgetMonth: string | null | undefined): string | null {
  if (!budgetMonth) return null;
  return budgetMonth.slice(0, 4);
}

export function currentBudgetMonth(): string {
  return toBudgetMonth(new Date())!;
}

export function currentBudgetYear(): string {
  return String(new Date().getUTCFullYear());
}

export type BudgetMonthRange = {
  start: string; // ISO date
  end: string; // ISO date
};

export function monthBoundaries(budgetMonth: string): BudgetMonthRange | null {
  const match = budgetMonth.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export type DueWindow = "overdue" | "due_today" | "due_7d" | "due_30d" | "later";

export function classifyDueDate(due: string | null, now = Date.now()): DueWindow {
  if (!due) return "later";
  const time = new Date(due).getTime();
  if (!Number.isFinite(time)) return "later";
  const diffDays = (time - now) / 86_400_000;
  if (diffDays < 0) return "overdue";
  if (diffDays < 1) return "due_today";
  if (diffDays <= 7) return "due_7d";
  if (diffDays <= 30) return "due_30d";
  return "later";
}
