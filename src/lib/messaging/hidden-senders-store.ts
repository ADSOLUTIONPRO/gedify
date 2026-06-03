import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/storage/data-dir";
import { randomUUID } from "node:crypto";

const DATA_DIR = getDataDir();
const FILE = path.join(DATA_DIR, "hidden-senders.json");

export type HiddenSender = {
  id: string;
  email: string;
  displayName: string | null;
  reason: string | null;
  hiddenCount: number;
  createdAt: string;
  updatedAt: string;
};

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<HiddenSender[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as HiddenSender[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: HiddenSender[]): Promise<void> {
  await ensureDir();
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function listHiddenSenders(): Promise<HiddenSender[]> {
  return readAll();
}

export async function getHiddenSenderEmails(): Promise<Set<string>> {
  const all = await readAll();
  return new Set(all.map((s) => s.email.toLowerCase()));
}

export async function hideSender(
  email: string,
  displayName: string | null = null,
  reason: string | null = null,
): Promise<HiddenSender> {
  const all = await readAll();
  const normalized = email.toLowerCase().trim();
  const existing = all.find((s) => s.email === normalized);
  const now = new Date().toISOString();

  if (existing) {
    existing.displayName = displayName ?? existing.displayName;
    existing.hiddenCount = (existing.hiddenCount ?? 0) + 1;
    existing.updatedAt = now;
    await writeAll(all);
    return existing;
  }

  const record: HiddenSender = {
    id: randomUUID(),
    email: normalized,
    displayName,
    reason,
    hiddenCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  all.push(record);
  await writeAll(all);
  return record;
}

export async function hideSendersBulk(
  senders: { email: string; displayName?: string | null }[],
): Promise<{ added: number; existing: number }> {
  const all = await readAll();
  const now = new Date().toISOString();
  let added = 0;
  let existing = 0;

  for (const sender of senders) {
    const normalized = sender.email.toLowerCase().trim();
    if (!normalized) continue;
    const found = all.find((s) => s.email === normalized);
    if (found) {
      found.hiddenCount = (found.hiddenCount ?? 0) + 1;
      found.updatedAt = now;
      existing++;
    } else {
      all.push({
        id: randomUUID(),
        email: normalized,
        displayName: sender.displayName ?? null,
        reason: null,
        hiddenCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      added++;
    }
  }

  await writeAll(all);
  return { added, existing };
}

export async function restoreSender(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((s) => s.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}

export async function clearAllHiddenSenders(): Promise<number> {
  const all = await readAll();
  const count = all.length;
  await writeAll([]);
  return count;
}
