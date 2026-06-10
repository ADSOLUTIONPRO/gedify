import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Liens ENTRE DOCUMENTS (relation symétrique), par utilisateur. Permet de
   rattacher des documents les uns aux autres (ex. un RIB ↔ un contrat). La
   paire est stockée normalisée (a < b) pour éviter les doublons ; la relation
   est bidirectionnelle. Stockage routé (JSON / SQLite / Postgres via pg-store).
   ──────────────────────────────────────────────────────────────────────── */

export type DocumentLink = {
  id: string;
  userId: string;
  a: number; // min(docId, otherId)
  b: number; // max(docId, otherId)
  createdAt: string;
};

const COLLECTION = "document_links";
const JSON_FILE = "document-links.json";

function jsonPath() { return path.join(getDataDir(), JSON_FILE); }
function pair(x: number, y: number): [number, number] { return x < y ? [x, y] : [y, x]; }

async function readAll(): Promise<DocumentLink[]> {
  if (pgStorageActive()) {
    try { return await pgReadAll<DocumentLink>(COLLECTION); }
    catch (e) { if (jsonFallback()) return readJson(); throw e; }
  }
  return readJson();
}

async function readJson(): Promise<DocumentLink[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DocumentLink[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(items: DocumentLink[]): Promise<void> {
  if (pgStorageActive()) { await pgWriteAll<DocumentLink>(COLLECTION, "id", (l) => l.id, items); return; }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

/** Ids des documents liés à `documentId` (récents d'abord). */
export async function listLinkedIds(userId: string, documentId: number): Promise<number[]> {
  const all = await readAll();
  return all
    .filter((l) => l.userId === userId && (l.a === documentId || l.b === documentId))
    .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))
    .map((l) => (l.a === documentId ? l.b : l.a));
}

export async function addLink(userId: string, documentId: number, otherId: number): Promise<void> {
  if (documentId === otherId) return;
  const [a, b] = pair(documentId, otherId);
  const all = await readAll();
  if (all.some((l) => l.userId === userId && l.a === a && l.b === b)) return; // anti-doublon
  all.push({ id: randomUUID(), userId, a, b, createdAt: new Date().toISOString() });
  await writeAll(all);
}

export async function removeLink(userId: string, documentId: number, otherId: number): Promise<void> {
  const [a, b] = pair(documentId, otherId);
  const all = await readAll();
  const next = all.filter((l) => !(l.userId === userId && l.a === a && l.b === b));
  if (next.length !== all.length) await writeAll(next);
}
