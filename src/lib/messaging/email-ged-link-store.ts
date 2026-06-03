import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDataDir } from "@/lib/storage/data-dir";
import type { EmailGedLink, EmailGedLinkTarget } from "./email-types";

const STORE_FILE = "email-ged-links.json";

function getFilePath() {
  return path.join(getDataDir(), STORE_FILE);
}

async function readAll(): Promise<EmailGedLink[]> {
  try {
    const raw = await readFile(getFilePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EmailGedLink[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeAll(items: EmailGedLink[]) {
  const filePath = getFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(items, null, 2), "utf8");
}

export async function listEmailLinks(filter?: {
  emailId?: string;
  accountId?: string;
  scope?: "message" | "thread";
  targetKind?: EmailGedLinkTarget["kind"];
}): Promise<EmailGedLink[]> {
  const all = await readAll();
  return all.filter((link) => {
    if (filter?.emailId && link.emailId !== filter.emailId) return false;
    if (filter?.accountId && link.accountId !== filter.accountId) return false;
    if (filter?.scope && link.scope !== filter.scope) return false;
    if (filter?.targetKind && link.target.kind !== filter.targetKind) return false;
    return true;
  });
}

export async function createEmailLink(
  input: Omit<EmailGedLink, "id" | "createdAt">
): Promise<EmailGedLink> {
  const all = await readAll();
  const link: EmailGedLink = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  all.unshift(link);
  await writeAll(all);
  return link;
}

export async function deleteEmailLink(id: string): Promise<void> {
  const all = await readAll();
  const next = all.filter((link) => link.id !== id);
  await writeAll(next);
}

/**
 * Index par scope=thread pour décorer la liste des threads de l'inbox.
 * Renvoie une Map threadId → liens existants.
 */
export async function indexLinksByThread(): Promise<Map<string, EmailGedLink[]>> {
  const all = await readAll();
  const map = new Map<string, EmailGedLink[]>();
  for (const link of all) {
    if (link.scope !== "thread") continue;
    const list = map.get(link.emailId) ?? [];
    list.push(link);
    map.set(link.emailId, list);
  }
  return map;
}
