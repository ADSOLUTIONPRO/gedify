import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getActionsDataDir } from "@/lib/budget/storage";
import type {
  ActionItem,
  ActionItemInput,
  ActionPriority,
  ActionStatus,
  ActionType,
} from "./types";

const INDEX_FILE = "actions.json";

async function ensureDir() {
  await mkdir(getActionsDataDir(), { recursive: true });
}

function indexPath() {
  return path.join(getActionsDataDir(), INDEX_FILE);
}

async function readAllJson(): Promise<ActionItem[]> {
  try {
    const raw = await readFile(indexPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActionItem[]) : [];
  } catch {
    return [];
  }
}

async function readAll(): Promise<ActionItem[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<ActionItem>("tasks");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: ActionItem[]) {
  if (pgStorageActive()) {
    await pgWriteAll<ActionItem>("tasks", "id", (a) => a.id, items);
    return;
  }
  await ensureDir();
  await writeFile(indexPath(), JSON.stringify(items, null, 2), "utf8");
}

function recomputeOverdue(item: ActionItem): ActionItem {
  if (item.status === "done" || item.status === "cancelled") return item;
  if (item.dueDate && new Date(item.dueDate).getTime() < Date.now()) {
    return { ...item, status: "overdue" };
  }
  if (item.status === "overdue" && item.dueDate && new Date(item.dueDate).getTime() >= Date.now()) {
    return { ...item, status: "todo" };
  }
  return item;
}

export type ListActionOptions = {
  status?: ActionStatus | "todo-and-overdue" | "open";
  priority?: ActionPriority;
  type?: ActionType;
  documentId?: number;
};

export async function listActions(options: ListActionOptions = {}): Promise<ActionItem[]> {
  const all = (await readAll()).map(recomputeOverdue);
  let filtered = all;
  if (options.status === "open") {
    filtered = filtered.filter(
      (entry) => entry.status !== "done" && entry.status !== "cancelled",
    );
  } else if (options.status === "todo-and-overdue") {
    filtered = filtered.filter(
      (entry) => entry.status === "todo" || entry.status === "overdue",
    );
  } else if (options.status) {
    filtered = filtered.filter((entry) => entry.status === options.status);
  }
  if (options.priority) {
    filtered = filtered.filter((entry) => entry.priority === options.priority);
  }
  if (options.type) {
    filtered = filtered.filter((entry) => entry.type === options.type);
  }
  if (options.documentId) {
    filtered = filtered.filter((entry) => entry.documentIds.includes(options.documentId!));
  }
  return filtered.sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export async function getAction(id: string): Promise<ActionItem | null> {
  const all = (await readAll()).map(recomputeOverdue);
  return all.find((entry) => entry.id === id) ?? null;
}

export async function createAction(input: ActionItemInput): Promise<ActionItem> {
  const now = new Date().toISOString();
  const item: ActionItem = {
    id: randomUUID(),
    title: input.title ?? "Nouvelle action",
    description: input.description ?? "",
    type: (input.type ?? "to-classify") as ActionType,
    status: (input.status ?? "todo") as ActionStatus,
    priority: (input.priority ?? "normal") as ActionPriority,
    dueDate: input.dueDate ?? null,
    documentIds: input.documentIds ?? [],
    projectId: input.projectId ?? null,
    correspondentId: input.correspondentId ?? null,
    budgetItemId: input.budgetItemId ?? null,
    amount: input.amount ?? null,
    currency: input.currency ?? null,
    createdFrom: input.createdFrom ?? "manual",
    aiAnalysisId: input.aiAnalysisId ?? null,
    aiConfidence: input.aiConfidence ?? null,
    notes: input.notes ?? "",
    history: [{ at: now, kind: "created", message: "Action créée" }],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  const all = await readAll();
  all.push(item);
  await writeAll(all);
  return item;
}

export async function updateAction(
  id: string,
  input: ActionItemInput,
): Promise<ActionItem | null> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  const next: ActionItem = {
    ...all[index],
    ...input,
    id: all[index].id,
    history: [
      ...all[index].history,
      { at: now, kind: "updated", message: "Action mise à jour" },
    ],
    updatedAt: now,
  };
  all[index] = next;
  await writeAll(all);
  return next;
}

export async function completeAction(id: string, note?: string): Promise<ActionItem | null> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  const next: ActionItem = {
    ...all[index],
    status: "done",
    completedAt: now,
    updatedAt: now,
    history: [
      ...all[index].history,
      { at: now, kind: "status-changed", message: note ?? "Terminée" },
    ],
  };
  all[index] = next;
  await writeAll(all);
  return next;
}

export async function postponeAction(id: string, newDueDate: string): Promise<ActionItem | null> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const now = new Date().toISOString();
  const next: ActionItem = {
    ...all[index],
    dueDate: newDueDate,
    status: "todo",
    updatedAt: now,
    history: [
      ...all[index].history,
      { at: now, kind: "postponed", message: `Reportée au ${newDueDate}` },
    ],
  };
  all[index] = next;
  await writeAll(all);
  return next;
}

export async function linkDocument(id: string, documentId: number): Promise<ActionItem | null> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  if (all[index].documentIds.includes(documentId)) return all[index];
  const now = new Date().toISOString();
  const next: ActionItem = {
    ...all[index],
    documentIds: [...all[index].documentIds, documentId],
    updatedAt: now,
    history: [
      ...all[index].history,
      { at: now, kind: "linked-document", message: `Document #${documentId} lié` },
    ],
  };
  all[index] = next;
  await writeAll(all);
  return next;
}

export async function deleteAction(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((entry) => entry.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
