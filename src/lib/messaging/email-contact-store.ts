import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";
import type { EmailContactRecord } from "./email-types";

const STORE_FILE = "email-contacts.json";

function getFilePath() {
  return path.join(getDataDir(), STORE_FILE);
}

async function readAllJson(): Promise<EmailContactRecord[]> {
  try {
    const raw = await readFile(getFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EmailContactRecord[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readAll(): Promise<EmailContactRecord[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<EmailContactRecord>("email_contacts", "id", "metadata");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: EmailContactRecord[]) {
  if (pgStorageActive()) {
    await pgWriteAll<EmailContactRecord>("email_contacts", "id", (c) => c.resourceName, items, "metadata");
    return;
  }
  const filePath = getFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(items, null, 2), "utf8");
}

export async function listEmailContacts(accountId?: string): Promise<EmailContactRecord[]> {
  const all = await readAll();
  return accountId ? all.filter((c) => c.accountId === accountId) : all;
}

export async function getEmailContact(resourceName: string): Promise<EmailContactRecord | null> {
  const all = await readAll();
  return all.find((c) => c.resourceName === resourceName) ?? null;
}

export async function upsertEmailContact(
  contact: EmailContactRecord
): Promise<EmailContactRecord> {
  const all = await readAll();
  const idx = all.findIndex((c) => c.resourceName === contact.resourceName);
  const next = { ...contact, updatedAt: new Date().toISOString() };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  await writeAll(all);
  return next;
}

export async function bulkUpsertEmailContacts(
  contacts: EmailContactRecord[]
): Promise<void> {
  if (contacts.length === 0) return;
  const all = await readAll();
  const byId = new Map(all.map((c) => [c.resourceName, c]));
  const now = new Date().toISOString();
  for (const contact of contacts) {
    byId.set(contact.resourceName, { ...contact, updatedAt: now });
  }
  await writeAll(Array.from(byId.values()));
}

/** Supprime un contact (manuel ou détecté). Renvoie true si supprimé. */
export async function removeEmailContact(resourceName: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((c) => c.resourceName !== resourceName);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}

/**
 * Fusionne plusieurs contacts dans un contact « gardé » : union des emails,
 * complète téléphone/société/correspondant manquants, supprime les autres.
 * Ne supprime jamais sans appel explicite (confirmation côté UI).
 */
export async function mergeEmailContacts(
  keepResourceName: string,
  dropResourceNames: string[],
): Promise<EmailContactRecord | null> {
  const all = await readAll();
  const keep = all.find((c) => c.resourceName === keepResourceName);
  if (!keep) return null;
  const drops = all.filter((c) => dropResourceNames.includes(c.resourceName) && c.resourceName !== keepResourceName);

  const emails = new Set<string>();
  for (const e of [...(keep.emails ?? []), ...(keep.email ? [keep.email] : [])]) emails.add(e.toLowerCase());
  let phone = keep.phone;
  let organization = keep.organization;
  let correspondentId = keep.correspondentId;
  for (const d of drops) {
    for (const e of [...(d.emails ?? []), ...(d.email ? [d.email] : [])]) emails.add(e.toLowerCase());
    phone = phone ?? d.phone;
    organization = organization ?? d.organization;
    correspondentId = correspondentId ?? d.correspondentId;
  }

  const merged: EmailContactRecord = {
    ...keep,
    emails: Array.from(emails),
    phone,
    organization,
    correspondentId,
    status: correspondentId ? "linked" : keep.status,
    updatedAt: new Date().toISOString(),
  };
  const dropSet = new Set(dropResourceNames.filter((r) => r !== keepResourceName));
  const next = all
    .filter((c) => !dropSet.has(c.resourceName))
    .map((c) => (c.resourceName === keepResourceName ? merged : c));
  await writeAll(next);
  return merged;
}

export async function setContactCorrespondent(
  resourceName: string,
  correspondentId: number | null
): Promise<EmailContactRecord | null> {
  const all = await readAll();
  const idx = all.findIndex((c) => c.resourceName === resourceName);
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    correspondentId,
    status: correspondentId ? "linked" : "ignored",
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
  return all[idx];
}
