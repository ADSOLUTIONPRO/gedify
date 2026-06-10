import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Documents ÉPINGLÉS PAR UTILISATEUR (distincts des favoris). Les documents
   épinglés apparaissent dans le widget « Documents épinglés » du tableau de
   bord. Stockage routé (JSON / SQLite / Postgres via pg-store). Un doc épinglé
   une seule fois par utilisateur, jamais visible par un autre.
   ──────────────────────────────────────────────────────────────────────── */

export type DocumentPin = {
  id: string;
  userId: string;
  documentId: number;
  createdAt: string;
};

const COLLECTION = "document_pins";
const JSON_FILE = "document-pins.json";

function jsonPath() { return path.join(getDataDir(), JSON_FILE); }

async function readAll(): Promise<DocumentPin[]> {
  if (pgStorageActive()) {
    try { return await pgReadAll<DocumentPin>(COLLECTION); }
    catch (e) { if (jsonFallback()) return readJson(); throw e; }
  }
  return readJson();
}

async function readJson(): Promise<DocumentPin[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DocumentPin[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(items: DocumentPin[]): Promise<void> {
  if (pgStorageActive()) { await pgWriteAll<DocumentPin>(COLLECTION, "id", (p) => p.id, items); return; }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

/** Ensemble des documentIds épinglés de l'utilisateur (récents d'abord). */
export async function listPinnedIds(userId: string): Promise<number[]> {
  const all = await readAll();
  return all
    .filter((p) => p.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((p) => p.documentId);
}

export async function isPinned(userId: string, documentId: number): Promise<boolean> {
  const all = await readAll();
  return all.some((p) => p.userId === userId && p.documentId === documentId);
}

export async function addPin(userId: string, documentId: number): Promise<void> {
  const all = await readAll();
  if (all.some((p) => p.userId === userId && p.documentId === documentId)) return; // anti-doublon
  all.push({ id: randomUUID(), userId, documentId, createdAt: new Date().toISOString() });
  await writeAll(all);
}

export async function removePin(userId: string, documentId: number): Promise<void> {
  const all = await readAll();
  const next = all.filter((p) => !(p.userId === userId && p.documentId === documentId));
  if (next.length !== all.length) await writeAll(next);
}
