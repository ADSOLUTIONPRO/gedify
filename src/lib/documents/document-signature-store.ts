import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgStorageActive, jsonFallback, pgReadScoped, pgWriteScoped } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";
import { randomUUID } from "node:crypto";

/**
 * Liaison entre un document original et sa **version signée** (signature
 * visuelle). Stockée en JSON local (même pattern que mail-document-links-store).
 * Les champs `method`/`hash` préparent une future signature certifiée.
 */

const DATA_DIR = getDataDir();
const FILE = path.join(DATA_DIR, "document-signatures.json");

export type SignatureMethod = "draw" | "image" | "text";

export type DocumentSignature = {
  id: string;
  originalDocumentId: number;
  signedDocumentId: number | null;
  signedTitle: string;
  signedAt: string;
  user: string | null;
  method: SignatureMethod;
  page: number;
  /** Coordonnées normalisées (0–1) de la signature sur la page. */
  coords: { x: number; y: number; w: number; h: number } | null;
  hash: string | null;
};

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readAllJson(): Promise<DocumentSignature[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DocumentSignature[]) : [];
  } catch {
    return [];
  }
}

async function readAll(): Promise<DocumentSignature[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadScoped<DocumentSignature>("signatures", "scope", "document");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: DocumentSignature[]): Promise<void> {
  if (pgStorageActive()) {
    await pgWriteScoped<DocumentSignature>("signatures", "id", (s) => s.id, items, {
      scopeCol: "scope",
      scopeVal: "document",
    });
    return;
  }
  await ensureDir();
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function createDocumentSignature(
  input: Omit<DocumentSignature, "id" | "signedAt"> & { signedAt?: string },
): Promise<DocumentSignature> {
  const record: DocumentSignature = {
    ...input,
    id: randomUUID(),
    signedAt: input.signedAt ?? new Date().toISOString(),
  };
  const all = await readAll();
  all.push(record);
  await writeAll(all);
  return record;
}

/** Signatures liées à un document (en tant qu'original OU version signée). */
export async function getSignaturesForDocument(documentId: number): Promise<DocumentSignature[]> {
  const all = await readAll();
  return all.filter((s) => s.originalDocumentId === documentId || s.signedDocumentId === documentId);
}
