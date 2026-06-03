import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getMailConnectorDataDir } from "@/lib/mail-connector/storage-paths";

export type ScheduledEmailStatus = "scheduled" | "sent" | "cancelled" | "failed";

export type ScheduledEmail = {
  id: string;
  gmailAccountId: string | null;
  to: string;
  cc: string | null;
  bcc: string | null;
  subject: string;
  bodyHtml: string;
  threadId: string | null;
  inReplyTo: string | null;
  draftId: string | null;
  scheduledAt: string;
  status: ScheduledEmailStatus;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  errorMessage: string | null;
};

export type ScheduledEmailInput = {
  gmailAccountId?: string | null;
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  bodyHtml: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  draftId?: string | null;
  scheduledAt: string;
};

const FILE = "scheduled-emails.json";

function filePath() {
  return path.join(getMailConnectorDataDir(), FILE);
}

async function readAll(): Promise<ScheduledEmail[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScheduledEmail[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: ScheduledEmail[]) {
  await mkdir(getMailConnectorDataDir(), { recursive: true });
  await writeFile(filePath(), JSON.stringify(items, null, 2), "utf8");
}

export async function listScheduledEmails(): Promise<ScheduledEmail[]> {
  return (await readAll()).sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
}

export async function createScheduledEmail(input: ScheduledEmailInput): Promise<ScheduledEmail> {
  const all = await readAll();
  const now = new Date().toISOString();
  const item: ScheduledEmail = {
    id: randomUUID(),
    gmailAccountId: input.gmailAccountId ?? null,
    to: input.to,
    cc: input.cc ?? null,
    bcc: input.bcc ?? null,
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    threadId: input.threadId ?? null,
    inReplyTo: input.inReplyTo ?? null,
    draftId: input.draftId ?? null,
    scheduledAt: input.scheduledAt,
    status: "scheduled",
    createdAt: now,
    updatedAt: now,
    sentAt: null,
    errorMessage: null,
  };
  all.push(item);
  await writeAll(all);
  return item;
}

export async function cancelScheduledEmail(id: string): Promise<boolean> {
  const all = await readAll();
  const i = all.findIndex((e) => e.id === id);
  if (i < 0) return false;
  if (all[i].status === "scheduled") {
    all[i] = { ...all[i], status: "cancelled", updatedAt: new Date().toISOString() };
    await writeAll(all);
  }
  return true;
}

export async function markScheduledEmail(
  id: string,
  patch: Partial<Pick<ScheduledEmail, "status" | "sentAt" | "errorMessage">>,
): Promise<void> {
  const all = await readAll();
  const i = all.findIndex((e) => e.id === id);
  if (i < 0) return;
  all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
  await writeAll(all);
}

/** Envois programmés dont l'échéance est atteinte et toujours en attente. */
export async function listDueScheduledEmails(nowIso: string): Promise<ScheduledEmail[]> {
  return (await readAll()).filter((e) => e.status === "scheduled" && e.scheduledAt <= nowIso);
}
