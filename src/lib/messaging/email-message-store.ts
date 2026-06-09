import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Index local des messages mail (pour la recherche plein-texte de l'assistant).
   Alimenté best-effort par la synchro IMAP (mailparser fournit subject/from/text).
   Permet une recherche plein-texte indépendante du provider (Gmail OU IMAP),
   là où l'API Gmail live ne couvre que les comptes Google.
   ──────────────────────────────────────────────────────────────────────── */

export type EmailMessageRecord = {
  id: string; // `${accountId}:${uid}`
  accountId: string;
  uid: string;
  messageId: string | null;
  from: string | null;
  to: string | null;
  subject: string | null;
  date: string | null; // ISO
  text: string; // corps (tronqué)
  hasAttachments: boolean;
  createdAt: string;
};

const FILE = () => path.join(getDataDir(), "email-messages.json");
const MAX = 3000;
const MAX_TEXT = 4000;

async function readAllJson(): Promise<EmailMessageRecord[]> {
  try {
    const raw = await readFile(FILE(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EmailMessageRecord[]) : [];
  } catch {
    return [];
  }
}

async function readAll(): Promise<EmailMessageRecord[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<EmailMessageRecord>("mails", "id", "raw");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: EmailMessageRecord[]): Promise<void> {
  if (pgStorageActive()) {
    await pgWriteAll<EmailMessageRecord>("mails", "id", (m) => m.id, items, "raw");
    return;
  }
  await mkdir(path.dirname(FILE()), { recursive: true });
  await writeFile(FILE(), JSON.stringify(items, null, 2), "utf8");
}

// Sérialise les écritures : la synchro appelle upsert en parallèle (fire-and-forget),
// sans cette file d'attente, des writeFile concurrents corrompraient le JSON.
let writeChain: Promise<void> = Promise.resolve();

export function upsertEmailMessage(rec: Omit<EmailMessageRecord, "createdAt">): Promise<void> {
  writeChain = writeChain.then(() => doUpsert(rec)).catch(() => {});
  return writeChain;
}

async function doUpsert(rec: Omit<EmailMessageRecord, "createdAt">): Promise<void> {
  const all = await readAll();
  const full: EmailMessageRecord = {
    ...rec,
    text: (rec.text ?? "").replace(/\s+/g, " ").slice(0, MAX_TEXT),
    createdAt: new Date().toISOString(),
  };
  const idx = all.findIndex((m) => m.id === rec.id);
  if (idx >= 0) all[idx] = full;
  else all.unshift(full);
  await writeAll(all.slice(0, MAX));
}

/** Message indexé par id (`${accountId}:${uid}`) — lecture seule de l'inbox unifiée. */
export async function getEmailMessageById(id: string): Promise<EmailMessageRecord | null> {
  const all = await readAll();
  return all.find((m) => m.id === id) ?? null;
}

/**
 * Nombre RÉEL de messages indexés PAR COMPTE (clé = accountId) + total.
 * L'id de chaque message est `${accountId}:${uid}` → strictement unique : un
 * message appartient à un seul compte et n'est compté qu'une fois (plus de
 * recopie d'un compteur global d'un compte sur l'autre).
 */
export async function countMessagesByAccount(): Promise<{ byAccount: Record<string, number>; total: number }> {
  const all = await readAll();
  const byAccount: Record<string, number> = {};
  for (const m of all) byAccount[m.accountId] = (byAccount[m.accountId] ?? 0) + 1;
  return { byAccount, total: all.length };
}

export async function searchEmailMessages(query: string, limit = 20): Promise<EmailMessageRecord[]> {
  const all = await readAll();
  const q = query.trim().toLowerCase();
  const matches = q
    ? all.filter(
        (m) =>
          (m.subject ?? "").toLowerCase().includes(q) ||
          (m.from ?? "").toLowerCase().includes(q) ||
          (m.to ?? "").toLowerCase().includes(q) ||
          m.text.toLowerCase().includes(q),
      )
    : all;
  return matches.slice(0, limit);
}
