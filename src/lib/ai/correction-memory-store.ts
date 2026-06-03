import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getAiDataDir } from "@/lib/budget/storage";
import type {
  CorrectionMemory,
  CorrectionMemoryInput,
  CorrectionSuggestion,
} from "./correction-memory-types";
import type { DetectedInfoKind } from "./detected-info-types";

const FILE = "correction-memory.json";

async function ensureDir() {
  await mkdir(getAiDataDir(), { recursive: true });
}

function filePath() {
  return path.join(getAiDataDir(), FILE);
}

async function readAll(): Promise<CorrectionMemory[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CorrectionMemory[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: CorrectionMemory[]) {
  await ensureDir();
  await writeFile(filePath(), JSON.stringify(items, null, 2), "utf8");
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function listCorrectionMemory(): Promise<CorrectionMemory[]> {
  return readAll();
}

export async function recordCorrection(input: CorrectionMemoryInput): Promise<CorrectionMemory> {
  const all = await readAll();
  const originalNormalized = normalize(input.originalValue);
  const existing = all.find(
    (entry) =>
      entry.fieldKind === input.fieldKind &&
      normalize(entry.originalValue) === originalNormalized,
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.correctedValue = input.correctedValue;
    existing.payload = { ...existing.payload, ...(input.payload ?? {}) };
    existing.context = { ...existing.context, ...(input.context ?? {}) };
    existing.documentId = input.documentId ?? existing.documentId;
    existing.correspondentId = input.correspondentId ?? existing.correspondentId;
    existing.confidence = input.confidence ?? existing.confidence;
    existing.usageCount = (existing.usageCount ?? 0) + 1;
    existing.updatedAt = now;
    await writeAll(all);
    return existing;
  }
  const record: CorrectionMemory = {
    id: randomUUID(),
    fieldKind: input.fieldKind,
    originalValue: input.originalValue,
    correctedValue: input.correctedValue,
    payload: input.payload ?? {},
    context: input.context ?? {},
    documentId: input.documentId ?? null,
    correspondentId: input.correspondentId ?? null,
    confidence: input.confidence ?? null,
    usageCount: 1,
    createdAt: now,
    updatedAt: now,
  };
  all.push(record);
  await writeAll(all);
  return record;
}

export async function suggestCorrection(
  fieldKind: DetectedInfoKind,
  candidateValue: string,
): Promise<CorrectionSuggestion | null> {
  if (!candidateValue) return null;
  const all = await readAll();
  const target = normalize(candidateValue);
  const filtered = all.filter((entry) => entry.fieldKind === fieldKind);
  const exact = filtered.find((entry) => normalize(entry.originalValue) === target);
  if (exact) return { memory: exact, match: "exact" };
  // very small fuzzy: substring match
  const fuzzy = filtered.find(
    (entry) =>
      target.includes(normalize(entry.originalValue)) ||
      normalize(entry.originalValue).includes(target),
  );
  if (fuzzy) return { memory: fuzzy, match: "fuzzy" };
  return null;
}

export async function deleteCorrectionMemory(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((entry) => entry.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
