import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getAiDataDir } from "@/lib/budget/storage";
import type {
  DetectedInfo,
  DetectedInfoInput,
  DetectedInfoKind,
  DetectedInfoSource,
  DetectedInfoStatus,
} from "./detected-info-types";

const FILE = "detected-infos.json";

async function ensureDir() {
  await mkdir(getAiDataDir(), { recursive: true });
}

function filePath() {
  return path.join(getAiDataDir(), FILE);
}

async function readAll(): Promise<DetectedInfo[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DetectedInfo[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: DetectedInfo[]) {
  await ensureDir();
  await writeFile(filePath(), JSON.stringify(items, null, 2), "utf8");
}

function normalizeValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase();
}

function buildItem(input: DetectedInfoInput, base?: DetectedInfo): DetectedInfo {
  const now = new Date().toISOString();
  const value = input.value ?? base?.value ?? "";
  return {
    id: base?.id ?? randomUUID(),
    sourceDocumentId: input.sourceDocumentId ?? base?.sourceDocumentId ?? null,
    sourceAnalysisId: input.sourceAnalysisId ?? base?.sourceAnalysisId ?? null,
    kind: (input.kind ?? base?.kind ?? "other") as DetectedInfoKind,
    label: input.label ?? base?.label ?? "Information",
    value,
    normalizedValue: input.normalizedValue ?? normalizeValue(value),
    amount: input.amount ?? base?.amount ?? null,
    currency: input.currency ?? base?.currency ?? null,
    dateValue: input.dateValue ?? base?.dateValue ?? null,
    textValue: input.textValue ?? base?.textValue ?? null,
    referenceValue: input.referenceValue ?? base?.referenceValue ?? null,
    confidence: input.confidence ?? base?.confidence ?? null,
    status: (input.status ?? base?.status ?? "detected") as DetectedInfoStatus,
    source: (input.source ?? base?.source ?? "ai") as DetectedInfoSource,
    fieldKey: input.fieldKey ?? base?.fieldKey ?? null,
    correspondentId: input.correspondentId ?? base?.correspondentId ?? null,
    correspondentName: input.correspondentName ?? base?.correspondentName ?? null,
    projectId: input.projectId ?? base?.projectId ?? null,
    projectName: input.projectName ?? base?.projectName ?? null,
    categoryId: input.categoryId ?? base?.categoryId ?? null,
    categoryName: input.categoryName ?? base?.categoryName ?? null,
    financialItemId: input.financialItemId ?? base?.financialItemId ?? null,
    actionId: input.actionId ?? base?.actionId ?? null,
    isEdited: input.isEdited ?? base?.isEdited ?? false,
    editedBy: input.editedBy ?? base?.editedBy ?? null,
    editedAt: input.editedAt ?? base?.editedAt ?? null,
    originalValue: input.originalValue ?? base?.originalValue ?? null,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  };
}

export type ListDetectedInfoOptions = {
  documentId?: number;
  analysisId?: string;
  kind?: DetectedInfoKind;
  status?: DetectedInfoStatus;
  source?: DetectedInfoSource;
  limit?: number;
};

export async function listDetectedInfos(
  options: ListDetectedInfoOptions = {},
): Promise<DetectedInfo[]> {
  const all = await readAll();
  let filtered = all;
  if (options.documentId !== undefined)
    filtered = filtered.filter((entry) => entry.sourceDocumentId === options.documentId);
  if (options.analysisId)
    filtered = filtered.filter((entry) => entry.sourceAnalysisId === options.analysisId);
  if (options.kind) filtered = filtered.filter((entry) => entry.kind === options.kind);
  if (options.status) filtered = filtered.filter((entry) => entry.status === options.status);
  if (options.source) filtered = filtered.filter((entry) => entry.source === options.source);
  const sorted = filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return options.limit ? sorted.slice(0, options.limit) : sorted;
}

export async function getDetectedInfo(id: string): Promise<DetectedInfo | null> {
  const all = await readAll();
  return all.find((entry) => entry.id === id) ?? null;
}

export async function createDetectedInfo(input: DetectedInfoInput): Promise<DetectedInfo> {
  const item = buildItem(input);
  const all = await readAll();
  all.push(item);
  await writeAll(all);
  return item;
}

export async function updateDetectedInfo(
  id: string,
  input: DetectedInfoInput,
): Promise<DetectedInfo | null> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const existing = all[index];
  // Capture the original value the first time the user edits.
  const originalValue =
    existing.originalValue ??
    (input.value !== undefined && input.value !== existing.value ? existing.value : null);
  const merged = buildItem(
    {
      ...input,
      isEdited:
        input.isEdited ??
        (input.value !== undefined && input.value !== existing.value
          ? true
          : existing.isEdited),
      editedAt:
        input.editedAt ??
        (input.value !== undefined && input.value !== existing.value
          ? new Date().toISOString()
          : existing.editedAt),
      status:
        input.status ??
        (input.value !== undefined && input.value !== existing.value
          ? "edited"
          : existing.status),
      originalValue,
    },
    existing,
  );
  all[index] = merged;
  await writeAll(all);
  return merged;
}

export async function deleteDetectedInfo(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((entry) => entry.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}

/**
 * Bulk-upsert: never delete user-edited / validated items even if the AI re-emits a
 * different value. Strategy: skip insertion if a similar entry (same kind + analysisId +
 * fieldKey) already exists with status edited/validated.
 */
export async function bulkUpsertFromSynthesis(items: DetectedInfoInput[]): Promise<DetectedInfo[]> {
  const all = await readAll();
  const created: DetectedInfo[] = [];
  for (const input of items) {
    const exists = all.find(
      (entry) =>
        entry.sourceAnalysisId === input.sourceAnalysisId &&
        entry.kind === input.kind &&
        entry.fieldKey === (input.fieldKey ?? null),
    );
    if (exists) {
      const userOwned =
        exists.status === "edited" ||
        exists.status === "validated" ||
        exists.status === "converted_to_budget" ||
        exists.status === "converted_to_action" ||
        exists.status === "converted_to_debt" ||
        exists.status === "converted_to_due_item";
      if (userOwned) continue;
      const merged = buildItem({ ...input, status: exists.status }, exists);
      const index = all.indexOf(exists);
      all[index] = merged;
      created.push(merged);
      continue;
    }
    const item = buildItem(input);
    all.push(item);
    created.push(item);
  }
  await writeAll(all);
  return created;
}
