import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/storage/data-dir";

/**
 * Lien entre un document et l'événement d'agenda Google créé depuis sa fiche
 * (« Ajouter à l'agenda »). Un seul événement « principal » par document suffit
 * pour basculer le bouton en « Ouvrir l'événement ». Stocké en JSON local.
 */

const DATA_DIR = getDataDir();
const FILE = path.join(DATA_DIR, "document-events.json");

export type DocumentEvent = {
  documentId: number;
  eventId: string;
  htmlLink: string | null;
  summary: string;
  start: string | null;
  createdAt: string;
  updatedAt: string;
};

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<DocumentEvent[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DocumentEvent[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: DocumentEvent[]): Promise<void> {
  await ensureDir();
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function getDocumentEvent(documentId: number): Promise<DocumentEvent | null> {
  const all = await readAll();
  return all.find((e) => e.documentId === documentId) ?? null;
}

export async function setDocumentEvent(
  documentId: number,
  data: { eventId: string; htmlLink?: string | null; summary: string; start?: string | null },
): Promise<DocumentEvent> {
  const now = new Date().toISOString();
  const all = await readAll();
  const index = all.findIndex((e) => e.documentId === documentId);
  const record: DocumentEvent = {
    documentId,
    eventId: data.eventId,
    htmlLink: data.htmlLink ?? null,
    summary: data.summary,
    start: data.start ?? null,
    createdAt: index >= 0 ? all[index].createdAt : now,
    updatedAt: now,
  };
  if (index >= 0) all[index] = record;
  else all.push(record);
  await writeAll(all);
  return record;
}

export async function deleteDocumentEvent(documentId: number): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((e) => e.documentId !== documentId);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
