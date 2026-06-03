import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/storage/data-dir";
import type { EmailContactRecord } from "./email-types";

const STORE_FILE = "email-contacts.json";

function getFilePath() {
  return path.join(getDataDir(), STORE_FILE);
}

async function readAll(): Promise<EmailContactRecord[]> {
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

async function writeAll(items: EmailContactRecord[]) {
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
