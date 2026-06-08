import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Historique d'apprentissage IA : pour chaque champ validé manuellement, on
   garde la valeur PROPOSÉE par l'IA et la valeur FINALE validée → permet de
   savoir si l'IA s'était trompée (wasCorrected) et de comprendre toute
   réécriture. Alimente le versionnement / l'amélioration des modèles appris.
   Complète learnFromValidation (qui agrège les modèles) sans le remplacer.
   ──────────────────────────────────────────────────────────────────────── */

export type LearningField = "documentType" | "correspondent" | "folder" | "tags" | "date" | "summary";
export type LearningSource = "manual" | "bulk_manual_edit" | "validated_ai" | "workflow";

export type LearningEvent = {
  id: string;
  documentId: number;
  field: LearningField;
  aiValue: string | null;
  validatedValue: string | null;
  wasCorrected: boolean;
  source: LearningSource;
  templateId: string | null;
  user: string | null;
  createdAt: string;
};

const COLLECTION = "ai_learning_history";
const JSON_FILE = "ai-learning-history.json";
const MAX = 5000;

function jsonPath() { return path.join(getDataDir(), JSON_FILE); }

async function readAll(): Promise<LearningEvent[]> {
  if (pgStorageActive()) {
    try { return await pgReadAll<LearningEvent>(COLLECTION); }
    catch (e) { if (jsonFallback()) return readJson(); throw e; }
  }
  return readJson();
}
async function readJson(): Promise<LearningEvent[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LearningEvent[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}
async function writeAll(items: LearningEvent[]): Promise<void> {
  if (pgStorageActive()) { await pgWriteAll<LearningEvent>(COLLECTION, "id", (e) => e.id, items); return; }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export type LearningEventInput = Omit<LearningEvent, "id" | "createdAt" | "wasCorrected"> & { wasCorrected?: boolean };

/** Enregistre des corrections de champ (ne garde que les changements utiles). */
export async function recordLearningEvents(events: LearningEventInput[]): Promise<void> {
  const meaningful = events.filter((e) => (e.aiValue ?? "") !== "" || (e.validatedValue ?? "") !== "");
  if (meaningful.length === 0) return;
  const now = new Date().toISOString();
  const all = await readAll();
  for (const e of meaningful) {
    all.push({
      id: randomUUID(),
      ...e,
      wasCorrected: e.wasCorrected ?? ((e.aiValue ?? "").trim().toLowerCase() !== (e.validatedValue ?? "").trim().toLowerCase()),
      createdAt: now,
    });
  }
  await writeAll(all.slice(-MAX));
}

export async function listLearningHistory(opts: { documentId?: number; field?: LearningField; correctedOnly?: boolean; limit?: number } = {}): Promise<LearningEvent[]> {
  let all = await readAll();
  if (opts.documentId != null) all = all.filter((e) => e.documentId === opts.documentId);
  if (opts.field) all = all.filter((e) => e.field === opts.field);
  if (opts.correctedOnly) all = all.filter((e) => e.wasCorrected);
  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return all.slice(0, opts.limit ?? 200);
}

export async function learningStats(): Promise<{ total: number; corrected: number; byField: Record<string, { total: number; corrected: number }> }> {
  const all = await readAll();
  const byField: Record<string, { total: number; corrected: number }> = {};
  let corrected = 0;
  for (const e of all) {
    byField[e.field] ??= { total: 0, corrected: 0 };
    byField[e.field].total += 1;
    if (e.wasCorrected) { byField[e.field].corrected += 1; corrected += 1; }
  }
  return { total: all.length, corrected, byField };
}
