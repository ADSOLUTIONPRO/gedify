import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadScoped, pgWriteScoped } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/** Signature email (texte/HTML) — distincte des signatures image de l'éditeur. */
export type EmailSignature = {
  id: string;
  name: string;
  /** Contenu HTML de la signature (richtext). */
  html: string;
  isDefault: boolean;
  /** Adresse email associée (optionnel) pour une signature par boîte. */
  mailbox: string | null;
  createdAt: string;
  updatedAt: string;
};

const STORE_FILE = "email-signatures.json";

function filePath() {
  return path.join(getDataDir(), STORE_FILE);
}

async function readAllJson(): Promise<EmailSignature[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EmailSignature[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function readAll(): Promise<EmailSignature[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadScoped<EmailSignature>("signatures", "scope", "email");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: EmailSignature[]) {
  if (pgStorageActive()) {
    await pgWriteScoped<EmailSignature>("signatures", "id", (s) => s.id, items, {
      scopeCol: "scope",
      scopeVal: "email",
    });
    return;
  }
  await mkdir(path.dirname(filePath()), { recursive: true });
  await writeFile(filePath(), JSON.stringify(items, null, 2), "utf8");
}

export async function listSignatures(): Promise<EmailSignature[]> {
  const all = await readAll();
  return all.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.name.localeCompare(b.name));
}

export async function getDefaultSignature(): Promise<EmailSignature | null> {
  const all = await readAll();
  return all.find((s) => s.isDefault) ?? all[0] ?? null;
}

export async function createSignature(input: {
  name: string;
  html: string;
  mailbox?: string | null;
  isDefault?: boolean;
}): Promise<EmailSignature> {
  const all = await readAll();
  const now = new Date().toISOString();
  const makeDefault = Boolean(input.isDefault) || all.length === 0;
  if (makeDefault) all.forEach((s) => (s.isDefault = false));
  const sig: EmailSignature = {
    id: randomUUID(),
    name: input.name.trim() || "Signature",
    html: input.html ?? "",
    mailbox: input.mailbox ?? null,
    isDefault: makeDefault,
    createdAt: now,
    updatedAt: now,
  };
  all.push(sig);
  await writeAll(all);
  return sig;
}

export async function updateSignature(
  id: string,
  patch: { name?: string; html?: string; mailbox?: string | null; isDefault?: boolean },
): Promise<EmailSignature | null> {
  const all = await readAll();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  if (patch.isDefault) all.forEach((s) => (s.isDefault = false));
  all[idx] = {
    ...all[idx],
    ...(patch.name !== undefined ? { name: patch.name.trim() || all[idx].name } : {}),
    ...(patch.html !== undefined ? { html: patch.html } : {}),
    ...(patch.mailbox !== undefined ? { mailbox: patch.mailbox } : {}),
    ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
    id,
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
  return all[idx];
}

export async function deleteSignature(id: string): Promise<void> {
  const all = await readAll();
  const removed = all.find((s) => s.id === id);
  const next = all.filter((s) => s.id !== id);
  // Promouvoir une nouvelle signature par défaut si on a supprimé celle par défaut.
  if (removed?.isDefault && next.length > 0 && !next.some((s) => s.isDefault)) {
    next[0].isDefault = true;
  }
  await writeAll(next);
}
