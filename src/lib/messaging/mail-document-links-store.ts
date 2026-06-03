import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/storage/data-dir";
import { randomUUID } from "node:crypto";

const DATA_DIR = getDataDir();
const FILE = path.join(DATA_DIR, "mail-document-links.json");

export type MailDocumentLinkStatus = "pending" | "imported" | "error" | "ignored";

export type MailDocumentLink = {
  id: string;
  accountId: string;
  mailId: string;
  threadId: string;
  attachmentId: string | null;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  paperlessDocumentId: number | null;
  documentTitle: string | null;
  status: MailDocumentLinkStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<MailDocumentLink[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as MailDocumentLink[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: MailDocumentLink[]): Promise<void> {
  await ensureDir();
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listMailDocumentLinks(filter?: {
  threadId?: string;
  mailId?: string;
  accountId?: string;
  status?: MailDocumentLinkStatus;
}): Promise<MailDocumentLink[]> {
  let all = await readAll();
  if (filter?.threadId) all = all.filter((l) => l.threadId === filter.threadId);
  if (filter?.mailId) all = all.filter((l) => l.mailId === filter.mailId);
  if (filter?.accountId) all = all.filter((l) => l.accountId === filter.accountId);
  if (filter?.status) all = all.filter((l) => l.status === filter.status);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMailDocumentLink(id: string): Promise<MailDocumentLink | null> {
  const all = await readAll();
  return all.find((l) => l.id === id) ?? null;
}

export async function findExistingLink(
  mailId: string,
  attachmentId: string | null,
): Promise<MailDocumentLink | null> {
  const all = await readAll();
  return (
    all.find(
      (l) =>
        l.mailId === mailId &&
        l.attachmentId === attachmentId &&
        l.status === "imported",
    ) ?? null
  );
}

export async function createMailDocumentLink(
  input: Omit<MailDocumentLink, "id" | "createdAt" | "updatedAt">,
): Promise<MailDocumentLink> {
  const now = new Date().toISOString();
  const link: MailDocumentLink = {
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const all = await readAll();
  all.push(link);
  await writeAll(all);
  return link;
}

export async function updateMailDocumentLink(
  id: string,
  patch: Partial<Pick<MailDocumentLink, "status" | "paperlessDocumentId" | "documentTitle" | "errorMessage">>,
): Promise<MailDocumentLink | null> {
  const all = await readAll();
  const index = all.findIndex((l) => l.id === id);
  if (index < 0) return null;
  const updated: MailDocumentLink = {
    ...all[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  all[index] = updated;
  await writeAll(all);
  return updated;
}

export async function indexLinksByThread(): Promise<Map<string, MailDocumentLink[]>> {
  const all = await readAll();
  const map = new Map<string, MailDocumentLink[]>();
  for (const link of all) {
    const existing = map.get(link.threadId) ?? [];
    existing.push(link);
    map.set(link.threadId, existing);
  }
  return map;
}
