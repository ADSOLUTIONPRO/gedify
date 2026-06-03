import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/storage/data-dir";
import { randomUUID } from "node:crypto";

const DATA_DIR = getDataDir();
const FILE = path.join(DATA_DIR, "mail-suppressed-attachments.json");

/**
 * Trace d'une pièce jointe mail dont le document GED a été supprimé
 * VOLONTAIREMENT — elle ne doit plus être réimportée automatiquement.
 */
export type SuppressedAttachment = {
  id: string;
  messageId: string | null;
  threadId: string | null;
  attachmentId: string | null;
  filename: string | null;
  sizeBytes: number | null;
  hash: string | null;
  paperlessDocumentId: number | null;
  deletedAt: string;
  deletedBy: string | null;
};

export type SuppressInput = Omit<SuppressedAttachment, "id" | "deletedAt"> & { deletedAt?: string };

/** Signature d'une pièce jointe candidate à l'import. */
export type AttachmentSignature = {
  messageId?: string | null;
  attachmentId?: string | null;
  filename?: string | null;
  sizeBytes?: number | null;
};

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<SuppressedAttachment[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SuppressedAttachment[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: SuppressedAttachment[]): Promise<void> {
  await ensureDir();
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listSuppressedAttachments(): Promise<SuppressedAttachment[]> {
  return readAll();
}

export async function addSuppressedAttachment(input: SuppressInput): Promise<SuppressedAttachment> {
  const all = await readAll();
  // Anti-doublon : même messageId+attachmentId ou même filename+taille.
  const exists = all.some((s) => matches(s, input));
  if (exists) return all.find((s) => matches(s, input))!;
  const entry: SuppressedAttachment = {
    ...input,
    id: randomUUID(),
    deletedAt: input.deletedAt ?? new Date().toISOString(),
  };
  all.push(entry);
  await writeAll(all);
  return entry;
}

function matches(entry: AttachmentSignature, sig: AttachmentSignature): boolean {
  if (entry.messageId && sig.messageId && entry.attachmentId && sig.attachmentId) {
    if (entry.messageId === sig.messageId && entry.attachmentId === sig.attachmentId) return true;
  }
  if (entry.filename && sig.filename && entry.sizeBytes != null && sig.sizeBytes != null) {
    if (entry.filename === sig.filename && entry.sizeBytes === sig.sizeBytes) return true;
  }
  return false;
}

/** Vrai si cette pièce jointe correspond à un document supprimé volontairement. */
export async function isAttachmentSuppressed(sig: AttachmentSignature): Promise<boolean> {
  const all = await readAll();
  return all.some((entry) => matches(entry, sig));
}

/** Réautorise l'import d'une pièce jointe (action « Réimporter quand même »). */
export async function removeSuppression(sig: AttachmentSignature): Promise<number> {
  const all = await readAll();
  const next = all.filter((entry) => !matches(entry, sig));
  if (next.length !== all.length) await writeAll(next);
  return all.length - next.length;
}
