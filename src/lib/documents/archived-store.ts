import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Statut « archivé » des documents (vrai champ de persistance GEDify).
   Paperless n'a pas de statut d'archive utilisateur (archived_file_name = le
   PDF OCR, présent sur presque tous les docs) → on persiste l'archivage côté
   GEDify, routé JSON / SQLite / Postgres via pg-store. Archive = état du
   document (global), pas une préférence personnelle.
   ──────────────────────────────────────────────────────────────────────── */

export type ArchivedDocument = {
  id: string; // = String(documentId) (clé stable, anti-doublon)
  documentId: number;
  archivedAt: string;
};

const COLLECTION = "document_archives";
const JSON_FILE = "document-archives.json";

function jsonPath() { return path.join(getDataDir(), JSON_FILE); }

async function readJson(): Promise<ArchivedDocument[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ArchivedDocument[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function readAll(): Promise<ArchivedDocument[]> {
  if (pgStorageActive()) {
    try { return await pgReadAll<ArchivedDocument>(COLLECTION); }
    catch (e) { if (jsonFallback()) return readJson(); throw e; }
  }
  return readJson();
}

async function writeAll(items: ArchivedDocument[]): Promise<void> {
  if (pgStorageActive()) { await pgWriteAll<ArchivedDocument>(COLLECTION, "id", (a) => a.id, items); return; }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

/** Ids des documents archivés (plus récents d'abord). */
export async function listArchivedIds(): Promise<number[]> {
  const all = await readAll();
  return all.sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : -1)).map((a) => a.documentId);
}

export async function isArchived(documentId: number): Promise<boolean> {
  const all = await readAll();
  return all.some((a) => a.documentId === documentId);
}

/** Archive (true) ou désarchive (false) un document. Idempotent. */
export async function setArchived(documentId: number, archived: boolean): Promise<void> {
  const all = await readAll();
  const exists = all.some((a) => a.documentId === documentId);
  if (archived) {
    if (exists) return;
    all.push({ id: String(documentId), documentId, archivedAt: new Date().toISOString() });
    await writeAll(all);
  } else {
    if (!exists) return;
    await writeAll(all.filter((a) => a.documentId !== documentId));
  }
}
