import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";
import { randomUUID } from "node:crypto";

/**
 * Signatures et paraphes **enregistrés** de l'utilisateur (images PNG
 * transparentes), réutilisables dans l'éditeur de signature PDF. Stockés en
 * JSON local (le dataURL inline reste petit pour quelques signatures).
 */

const DATA_DIR = getDataDir();
const FILE = path.join(DATA_DIR, "document-saved-signatures.json");

export type SavedSignatureKind = "signature" | "paraphe";

export type SavedSignature = {
  id: string;
  kind: SavedSignatureKind;
  name: string;
  dataUrl: string;
  createdAt: string;
};

export type SavedSignatureInput = { kind: SavedSignatureKind; name?: string; dataUrl: string };

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readAllJson(): Promise<SavedSignature[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedSignature[]) : [];
  } catch {
    return [];
  }
}

async function readAll(): Promise<SavedSignature[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<SavedSignature>("saved_signatures", "id", "metadata");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: SavedSignature[]): Promise<void> {
  if (pgStorageActive()) {
    await pgWriteAll<SavedSignature>("saved_signatures", "id", (s) => s.id, items, "metadata");
    return;
  }
  await ensureDir();
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listSavedSignatures(): Promise<SavedSignature[]> {
  const all = await readAll();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createSavedSignature(input: SavedSignatureInput): Promise<SavedSignature> {
  if (!input.dataUrl || !/^data:image\/[a-z+]+;base64,/i.test(input.dataUrl)) {
    throw new Error("dataUrl image invalide.");
  }
  const kind: SavedSignatureKind = input.kind === "paraphe" ? "paraphe" : "signature";
  const record: SavedSignature = {
    id: randomUUID(),
    kind,
    name: input.name?.trim() || (kind === "paraphe" ? "Paraphe" : "Signature"),
    dataUrl: input.dataUrl,
    createdAt: new Date().toISOString(),
  };
  const all = await readAll();
  all.push(record);
  await writeAll(all);
  return record;
}

export async function removeSavedSignature(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((s) => s.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
