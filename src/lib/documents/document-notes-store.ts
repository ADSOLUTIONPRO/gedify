import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/storage/data-dir";
import { randomUUID } from "node:crypto";

/**
 * Notes GED enrichies d'un document (Gedify au-dessus des notes Paperless
 * texte-brut) : elles portent une **nature** (appel / rdv / autre), une **date
 * éditable** et un **auteur**. Stockées en JSON local, comme les autres stores
 * GED (cf. mail-document-links-store).
 */

const DATA_DIR = getDataDir();
const FILE = path.join(DATA_DIR, "document-notes.json");

/** Nature de la note — union typée extensible. */
export type DocumentNoteNature = "appel" | "rdv" | "autre";

export type DocumentNote = {
  id: string;
  documentId: number;
  content: string;
  nature: DocumentNoteNature;
  /** Date « métier » de la note (ISO), modifiable par l'utilisateur. */
  noteDate: string;
  author: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentNoteInput = {
  content: string;
  nature?: DocumentNoteNature;
  noteDate?: string;
  author?: string | null;
};

function isNature(value: unknown): value is DocumentNoteNature {
  return value === "appel" || value === "rdv" || value === "autre";
}

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<DocumentNote[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DocumentNote[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: DocumentNote[]): Promise<void> {
  await ensureDir();
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

/** Notes d'un document, triées de la plus récente à la plus ancienne (noteDate). */
export async function listDocumentNotes(documentId: number): Promise<DocumentNote[]> {
  const all = await readAll();
  return all
    .filter((n) => n.documentId === documentId)
    .sort((a, b) => b.noteDate.localeCompare(a.noteDate));
}

export async function createDocumentNote(documentId: number, input: DocumentNoteInput): Promise<DocumentNote> {
  const now = new Date().toISOString();
  const note: DocumentNote = {
    id: randomUUID(),
    documentId,
    content: input.content.trim(),
    nature: isNature(input.nature) ? input.nature : "autre",
    noteDate: input.noteDate ?? now,
    author: input.author ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const all = await readAll();
  all.push(note);
  await writeAll(all);
  return note;
}

export async function updateDocumentNote(
  id: string,
  patch: Partial<DocumentNoteInput>,
): Promise<DocumentNote | null> {
  const all = await readAll();
  const index = all.findIndex((n) => n.id === id);
  if (index < 0) return null;
  const current = all[index];
  const updated: DocumentNote = {
    ...current,
    content: patch.content !== undefined ? patch.content.trim() : current.content,
    nature: isNature(patch.nature) ? patch.nature : current.nature,
    noteDate: patch.noteDate ?? current.noteDate,
    author: patch.author !== undefined ? patch.author : current.author,
    updatedAt: new Date().toISOString(),
  };
  all[index] = updated;
  await writeAll(all);
  return updated;
}

export async function deleteDocumentNote(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((n) => n.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
