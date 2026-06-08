import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Favoris documentaires PAR UTILISATEUR. Stockage routé (JSON / SQLite /
   Postgres via pg-store). Contrainte logique : un doc favori une seule fois
   par utilisateur. Un favori d'un utilisateur n'est jamais visible par un autre.
   ──────────────────────────────────────────────────────────────────────── */

export type DocumentFavorite = {
  id: string;
  userId: string;
  documentId: number;
  createdAt: string;
};

const COLLECTION = "document_favorites";
const JSON_FILE = "document-favorites.json";

function jsonPath() { return path.join(getDataDir(), JSON_FILE); }

async function readAll(): Promise<DocumentFavorite[]> {
  if (pgStorageActive()) {
    try { return await pgReadAll<DocumentFavorite>(COLLECTION); }
    catch (e) { if (jsonFallback()) return readJson(); throw e; }
  }
  return readJson();
}

async function readJson(): Promise<DocumentFavorite[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DocumentFavorite[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(items: DocumentFavorite[]): Promise<void> {
  if (pgStorageActive()) { await pgWriteAll<DocumentFavorite>(COLLECTION, "id", (f) => f.id, items); return; }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

/** Ensemble des documentIds favoris de l'utilisateur (ordre d'ajout récent d'abord). */
export async function listFavoriteIds(userId: string): Promise<number[]> {
  const all = await readAll();
  return all
    .filter((f) => f.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((f) => f.documentId);
}

export async function isFavorite(userId: string, documentId: number): Promise<boolean> {
  const all = await readAll();
  return all.some((f) => f.userId === userId && f.documentId === documentId);
}

export async function addFavorite(userId: string, documentId: number): Promise<void> {
  const all = await readAll();
  if (all.some((f) => f.userId === userId && f.documentId === documentId)) return; // anti-doublon
  all.push({ id: randomUUID(), userId, documentId, createdAt: new Date().toISOString() });
  await writeAll(all);
}

export async function removeFavorite(userId: string, documentId: number): Promise<void> {
  const all = await readAll();
  const next = all.filter((f) => !(f.userId === userId && f.documentId === documentId));
  if (next.length !== all.length) await writeAll(next);
}
