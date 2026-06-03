import "server-only";

import {
  currentBudgetMonth,
  currentBudgetYear,
} from "./budget-periods";
import { listFinancialItems } from "./financial-item-store";
import type { FinancialItem } from "./financial-item-types";

export type BudgetTotals = {
  incoming: number;
  incomingReceived: number;
  outgoing: number;
  outgoingPaid: number;
  remaining: number;
  overdueCount: number;
  itemCount: number;
};

function isPositive(item: FinancialItem): boolean {
  return item.direction === "incoming";
}

function isOpenForBudget(item: FinancialItem): boolean {
  return (
    item.validationStatus !== "ignored" &&
    item.validationStatus !== "rejected" &&
    item.status !== "cancelled" &&
    item.status !== "ignored"
  );
}

export async function getBudgetTotals(filter: {
  budgetMonth?: string;
  budgetYear?: string;
  correspondentId?: number;
  projectId?: string;
  validatedOnly?: boolean;
}): Promise<BudgetTotals> {
  const items = await listFinancialItems({
    budgetMonth: filter.budgetMonth,
    budgetYear: filter.budgetYear,
    correspondentId: filter.correspondentId,
    projectId: filter.projectId,
  });

  let incoming = 0;
  let incomingReceived = 0;
  let outgoing = 0;
  let outgoingPaid = 0;
  let remaining = 0;
  let overdueCount = 0;

  for (const item of items) {
    if (!isOpenForBudget(item)) continue;
    if (filter.validatedOnly && item.validationStatus !== "validated") continue;
    if (isPositive(item)) {
      incoming += item.amount;
      if (item.status === "paid" || item.paymentStatus === "paid") {
        incomingReceived += item.amount;
      }
    } else if (item.direction === "outgoing") {
      outgoing += item.amount;
      outgoingPaid += item.amountPaid;
      remaining += item.amountRemaining ?? Math.max(0, item.amount - item.amountPaid);
      if (item.paymentStatus === "overdue") overdueCount += 1;
    }
  }

  return {
    incoming,
    incomingReceived,
    outgoing,
    outgoingPaid,
    remaining,
    overdueCount,
    itemCount: items.length,
  };
}

export async function getMonthlySummary(budgetMonth: string = currentBudgetMonth()) {
  const items = await listFinancialItems({ budgetMonth });
  const totals = await getBudgetTotals({ budgetMonth });
  return {
    budgetMonth,
    items,
    totals,
  };
}

export async function getYearlySummary(budgetYear: string = currentBudgetYear()) {
  const items = await listFinancialItems({ budgetYear });
  const byMonth: Record<
    string,
    { incoming: number; outgoing: number; remaining: number; paid: number; count: number }
  > = {};
  for (const item of items) {
    if (!item.budgetMonth) continue;
    const slot = byMonth[item.budgetMonth] ?? {
      incoming: 0,
      outgoing: 0,
      remaining: 0,
      paid: 0,
      count: 0,
    };
    slot.count += 1;
    if (item.direction === "incoming") slot.incoming += item.amount;
    if (item.direction === "outgoing") {
      slot.outgoing += item.amount;
      slot.paid += item.amountPaid;
      slot.remaining += item.amountRemaining ?? 0;
    }
    byMonth[item.budgetMonth] = slot;
  }
  return {
    budgetYear,
    months: Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, summary]) => ({ month, ...summary })),
  };
}

export type CorrespondentBudgetSummary = {
  correspondentId: number | null;
  correspondentName: string;
  total: number;
  paid: number;
  remaining: number;
  overdue: number;
  itemCount: number;
  nextDueDate: string | null;
  kinds: string[];
};

export async function getAllCorrespondentsFinancialSummary(): Promise<CorrespondentBudgetSummary[]> {
  const items = await listFinancialItems();
  const map = new Map<string, CorrespondentBudgetSummary>();

  for (const item of items) {
    if (!isOpenForBudget(item)) continue;
    const key =
      item.correspondentId !== null
        ? `id:${item.correspondentId}`
        : `name:${(item.correspondentName ?? "Sans correspondant").toLowerCase()}`;
    const current = map.get(key) ?? {
      correspondentId: item.correspondentId,
      correspondentName: item.correspondentName ?? "Sans correspondant",
      total: 0,
      paid: 0,
      remaining: 0,
      overdue: 0,
      itemCount: 0,
      nextDueDate: null as string | null,
      kinds: [] as string[],
    };
    current.total += item.amount;
    current.paid += item.amountPaid;
    current.remaining += item.amountRemaining ?? Math.max(0, item.amount - item.amountPaid);
    current.itemCount += 1;
    if (item.paymentStatus === "overdue") {
      current.overdue += item.amountRemaining ?? item.amount;
    }
    if (item.dueDate) {
      if (!current.nextDueDate || item.dueDate < current.nextDueDate) {
        current.nextDueDate = item.dueDate;
      }
    }
    if (!current.kinds.includes(item.kind)) current.kinds.push(item.kind);
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => b.remaining - a.remaining);
}

export async function getCorrespondentFinancialSummary(
  correspondentId: number,
): Promise<{
  summary: CorrespondentBudgetSummary | null;
  items: FinancialItem[];
}> {
  const items = await listFinancialItems({ correspondentId });
  const all = await getAllCorrespondentsFinancialSummary();
  const summary =
    all.find((entry) => entry.correspondentId === correspondentId) ?? null;
  return { summary, items };
}

export async function getDueItemsWindow(daysAhead: number = 30): Promise<FinancialItem[]> {
  const items = await listFinancialItems();
  const cutoff = Date.now() + daysAhead * 86_400_000;
  return items.filter((item) => {
    if (!isOpenForBudget(item)) return false;
    if (!item.dueDate) return false;
    const time = new Date(item.dueDate).getTime();
    return time <= cutoff && item.status !== "paid";
  });
}

export async function getOverdueItems(): Promise<FinancialItem[]> {
  const items = await listFinancialItems();
  return items.filter((item) => {
    if (!isOpenForBudget(item)) return false;
    return item.paymentStatus === "overdue";
  });
}

/**
 * Every financial item that has a due date OR a "to-review/suggested" status with no date.
 * Used by /budget/echeances which must show past, future and undated items.
 */
export type DueBucket = "overdue" | "this_week" | "this_month" | "later" | "undated";

export async function getAllDueItems(): Promise<{
  bucketed: Record<DueBucket, FinancialItem[]>;
  all: FinancialItem[];
}> {
  const items = await listFinancialItems();
  const open = items.filter(
    (item) =>
      isOpenForBudget(item) &&
      item.status !== "paid" &&
      (item.dueDate !== null || item.status === "to_review" || item.status === "suggested"),
  );
  const now = Date.now();
  const oneWeek = now + 7 * 86_400_000;
  const oneMonth = now + 30 * 86_400_000;
  const bucketed: Record<DueBucket, FinancialItem[]> = {
    overdue: [],
    this_week: [],
    this_month: [],
    later: [],
    undated: [],
  };
  for (const item of open) {
    if (!item.dueDate) {
      bucketed.undated.push(item);
      continue;
    }
    const time = new Date(item.dueDate).getTime();
    if (time < now) bucketed.overdue.push(item);
    else if (time <= oneWeek) bucketed.this_week.push(item);
    else if (time <= oneMonth) bucketed.this_month.push(item);
    else bucketed.later.push(item);
  }
  return { bucketed, all: open };
}

export async function getAllDebts(): Promise<FinancialItem[]> {
  const items = await listFinancialItems({ kind: "debt" });
  return items.filter((item) => isOpenForBudget(item));
}
