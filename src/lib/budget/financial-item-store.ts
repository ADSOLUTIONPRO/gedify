import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getBudgetDataDir } from "./storage";
import { classifyDueDate, toBudgetYear } from "./budget-periods";
import {
  KIND_TO_DIRECTION,
  type FinancialItem,
  type FinancialItemInput,
  type FinancialPaymentStatus,
} from "./financial-item-types";

const FILE = "financial-items.json";

async function ensureDir() {
  await mkdir(getBudgetDataDir(), { recursive: true });
}

function filePath() {
  return path.join(getBudgetDataDir(), FILE);
}

async function readAllJson(): Promise<FinancialItem[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FinancialItem[]) : [];
  } catch {
    return [];
  }
}

async function readAll(): Promise<FinancialItem[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<FinancialItem>("budget_entries");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: FinancialItem[]) {
  if (pgStorageActive()) {
    await pgWriteAll<FinancialItem>("budget_entries", "id", (i) => i.id, items);
    return;
  }
  await ensureDir();
  await writeFile(filePath(), JSON.stringify(items, null, 2), "utf8");
}

function recomputePaymentStatus(item: FinancialItem): FinancialPaymentStatus {
  if (item.status === "paid") return "paid";
  if (item.status === "partially_paid") return "partial";
  if (item.status === "cancelled" || item.status === "ignored") return "unknown";
  if (!item.dueDate) return "unknown";
  const window = classifyDueDate(item.dueDate);
  if (window === "overdue") return "overdue";
  if (window === "due_today" || window === "due_7d") return "due_soon";
  if (window === "due_30d") return "due";
  return "not_due";
}

function normalize(input: FinancialItemInput, base?: FinancialItem): FinancialItem {
  const now = new Date().toISOString();
  const kind = input.kind ?? base?.kind ?? "other";
  const direction = input.direction ?? KIND_TO_DIRECTION[kind] ?? "neutral";
  const amount = input.amount ?? base?.amount ?? 0;
  const amountPaid = input.amountPaid ?? base?.amountPaid ?? 0;
  const amountRemaining =
    input.amountRemaining !== undefined
      ? input.amountRemaining
      : base?.amountRemaining !== undefined
        ? base.amountRemaining
        : Math.max(0, amount - amountPaid);

  const budgetMonth = input.budgetMonth ?? base?.budgetMonth ?? null;
  const item: FinancialItem = {
    id: base?.id ?? randomUUID(),
    sourceDocumentId: input.sourceDocumentId ?? base?.sourceDocumentId ?? null,
    sourceDocumentTitle: input.sourceDocumentTitle ?? base?.sourceDocumentTitle ?? null,
    sourcePaperlessUrl: input.sourcePaperlessUrl ?? base?.sourcePaperlessUrl ?? null,
    sourceAnalysisId: input.sourceAnalysisId ?? base?.sourceAnalysisId ?? null,
    kind,
    direction,
    label: input.label ?? base?.label ?? "Élément financier",
    description: input.description ?? base?.description ?? "",
    amount,
    currency: input.currency ?? base?.currency ?? "EUR",
    taxAmount: input.taxAmount ?? base?.taxAmount ?? null,
    amountWithoutTax: input.amountWithoutTax ?? base?.amountWithoutTax ?? null,
    amountPaid,
    amountRemaining,
    documentDate: input.documentDate ?? base?.documentDate ?? null,
    issueDate: input.issueDate ?? base?.issueDate ?? null,
    dueDate: input.dueDate ?? base?.dueDate ?? null,
    paidDate: input.paidDate ?? base?.paidDate ?? null,
    periodStart: input.periodStart ?? base?.periodStart ?? null,
    periodEnd: input.periodEnd ?? base?.periodEnd ?? null,
    budgetMonth,
    budgetYear: input.budgetYear ?? base?.budgetYear ?? toBudgetYear(budgetMonth),
    correspondentId: input.correspondentId ?? base?.correspondentId ?? null,
    correspondentName: input.correspondentName ?? base?.correspondentName ?? null,
    projectId: input.projectId ?? base?.projectId ?? null,
    projectName: input.projectName ?? base?.projectName ?? null,
    categoryId: input.categoryId ?? base?.categoryId ?? null,
    categoryName: input.categoryName ?? base?.categoryName ?? null,
    tags: input.tags ?? base?.tags ?? [],
    status: input.status ?? base?.status ?? "suggested",
    paymentStatus: input.paymentStatus ?? base?.paymentStatus ?? "unknown",
    recurrence: input.recurrence ?? base?.recurrence ?? "one_shot",
    recurrenceFrequency: input.recurrenceFrequency ?? base?.recurrenceFrequency ?? null,
    reference: input.reference ?? base?.reference ?? null,
    contractNumber: input.contractNumber ?? base?.contractNumber ?? null,
    customerNumber: input.customerNumber ?? base?.customerNumber ?? null,
    invoiceNumber: input.invoiceNumber ?? base?.invoiceNumber ?? null,
    isAiDetected: input.isAiDetected ?? base?.isAiDetected ?? false,
    aiConfidence: input.aiConfidence ?? base?.aiConfidence ?? null,
    aiProvider: input.aiProvider ?? base?.aiProvider ?? null,
    validationStatus: input.validationStatus ?? base?.validationStatus ?? "pending",
    validatedAt: input.validatedAt ?? base?.validatedAt ?? null,
    ignoredAt: input.ignoredAt ?? base?.ignoredAt ?? null,
    notes: input.notes ?? base?.notes ?? "",
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  };
  // Recompute payment status if user didn't override it explicitly
  if (!input.paymentStatus) {
    item.paymentStatus = recomputePaymentStatus(item);
  }
  return item;
}

export type ListFinancialItemsOptions = {
  status?: FinancialItem["status"];
  validationStatus?: FinancialItem["validationStatus"];
  kind?: FinancialItem["kind"];
  direction?: FinancialItem["direction"];
  budgetMonth?: string;
  budgetYear?: string;
  correspondentId?: number;
  projectId?: string;
  documentId?: number;
  /** Restreint aux lignes liées à ces documents (perf : page Documents paginée). */
  documentIds?: number[];
  analysisId?: string;
  limit?: number;
};

export async function listFinancialItems(
  options: ListFinancialItemsOptions = {},
): Promise<FinancialItem[]> {
  const all = await readAll();
  let filtered = all;
  if (options.status) filtered = filtered.filter((e) => e.status === options.status);
  if (options.validationStatus)
    filtered = filtered.filter((e) => e.validationStatus === options.validationStatus);
  if (options.kind) filtered = filtered.filter((e) => e.kind === options.kind);
  if (options.direction) filtered = filtered.filter((e) => e.direction === options.direction);
  if (options.budgetMonth)
    filtered = filtered.filter((e) => e.budgetMonth === options.budgetMonth);
  if (options.budgetYear)
    filtered = filtered.filter((e) => e.budgetYear === options.budgetYear);
  if (options.correspondentId !== undefined)
    filtered = filtered.filter((e) => e.correspondentId === options.correspondentId);
  if (options.projectId)
    filtered = filtered.filter((e) => e.projectId === options.projectId);
  if (options.documentId !== undefined)
    filtered = filtered.filter((e) => e.sourceDocumentId === options.documentId);
  if (options.documentIds) {
    const set = new Set(options.documentIds);
    filtered = filtered.filter((e) => e.sourceDocumentId != null && set.has(e.sourceDocumentId));
  }
  if (options.analysisId)
    filtered = filtered.filter((e) => e.sourceAnalysisId === options.analysisId);

  const sorted = filtered.sort((a, b) => {
    const aDate = a.dueDate ?? a.documentDate ?? a.createdAt;
    const bDate = b.dueDate ?? b.documentDate ?? b.createdAt;
    return aDate.localeCompare(bDate);
  });

  return options.limit ? sorted.slice(0, options.limit) : sorted;
}

export async function getFinancialItem(id: string): Promise<FinancialItem | null> {
  const all = await readAll();
  return all.find((e) => e.id === id) ?? null;
}

export async function createFinancialItem(input: FinancialItemInput): Promise<FinancialItem> {
  const item = normalize(input);
  const all = await readAll();
  all.push(item);
  await writeAll(all);
  return item;
}

export async function updateFinancialItem(
  id: string,
  input: FinancialItemInput,
): Promise<FinancialItem | null> {
  const all = await readAll();
  const index = all.findIndex((e) => e.id === id);
  if (index < 0) return null;
  const updated = normalize(input, all[index]);
  all[index] = updated;
  await writeAll(all);
  return updated;
}

export async function deleteFinancialItem(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((e) => e.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}

/**
 * Upsert anti-doublon : pour un documentId + kind + montant + date donnés,
 * met à jour la ligne existante si elle n'est pas encore validée,
 * ou crée une nouvelle ligne si aucun doublon n'est détecté.
 *
 * Critères de doublon (ET logique) :
 *   sourceDocumentId, kind, amount (tolérance ±0.01), sourceAnalysisId (si fourni)
 *
 * Une ligne validée (paid / partially_paid / validationStatus=validated) n'est jamais écrasée.
 */
export async function upsertFinancialItemFromAnalysis(
  input: FinancialItemInput,
): Promise<{ item: FinancialItem; created: boolean }> {
  const all = await readAll();
  const docId = input.sourceDocumentId ?? null;
  const kind = input.kind;
  const amount = input.amount ?? 0;

  if (docId !== null && kind) {
    const duplicate = all.find((existing) => {
      if (existing.sourceDocumentId !== docId) return false;
      if (existing.kind !== kind) return false;
      if (Math.abs(existing.amount - amount) > 0.01) return false;
      const isValidated =
        existing.validationStatus === "validated" ||
        existing.status === "paid" ||
        existing.status === "partially_paid";
      if (isValidated) return false;
      return true;
    });

    if (duplicate) {
      const updated = normalize(input, duplicate);
      const index = all.indexOf(duplicate);
      all[index] = updated;
      await writeAll(all);
      return { item: updated, created: false };
    }
  }

  const created = normalize(input);
  all.push(created);
  await writeAll(all);
  return { item: created, created: true };
}

export async function recordPayment(
  id: string,
  amount: number,
  date?: string,
): Promise<FinancialItem | null> {
  const all = await readAll();
  const index = all.findIndex((e) => e.id === id);
  if (index < 0) return null;
  const item = all[index];
  const newPaid = Math.round((item.amountPaid + amount) * 100) / 100;
  const newRemaining = Math.max(0, item.amount - newPaid);
  const status: FinancialItem["status"] =
    newRemaining === 0 ? "paid" : newPaid > 0 ? "partially_paid" : item.status;
  const updated = normalize(
    {
      amountPaid: newPaid,
      amountRemaining: newRemaining,
      status,
      paidDate: status === "paid" ? date ?? new Date().toISOString().slice(0, 10) : item.paidDate,
    },
    item,
  );
  all[index] = updated;
  await writeAll(all);
  return updated;
}
