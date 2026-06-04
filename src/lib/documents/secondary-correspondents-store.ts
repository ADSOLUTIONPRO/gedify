import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  pgStorageActive,
  jsonFallback,
  pgReadDocCorrespondents,
  pgWriteDocCorrespondents,
} from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

const DATA_DIR = getDataDir();
const FILE = path.join(DATA_DIR, "document-secondary-correspondents.json");

/**
 * Correspondants SECONDAIRES d'un document (Paperless n'en gère qu'un seul
 * nativement). Le correspondant principal reste celui du moteur local ; les
 * secondaires sont stockés côté GED.
 */
type Entry = { documentId: number; correspondentIds: number[] };

const PG_ROLE = "secondary";

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readAllJson(): Promise<Entry[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Entry[]) : [];
  } catch {
    return [];
  }
}

async function readAll(): Promise<Entry[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadDocCorrespondents(PG_ROLE);
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: Entry[]): Promise<void> {
  if (pgStorageActive()) {
    await pgWriteDocCorrespondents(PG_ROLE, items);
    return;
  }
  await ensureDir();
  await writeFile(FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function getSecondaryCorrespondents(documentId: number): Promise<number[]> {
  const all = await readAll();
  return all.find((e) => e.documentId === documentId)?.correspondentIds ?? [];
}

/** Map documentId → ids (pour enrichir une liste de documents en une lecture). */
export async function getSecondaryCorrespondentsMap(documentIds: number[]): Promise<Map<number, number[]>> {
  const all = await readAll();
  const wanted = new Set(documentIds);
  const map = new Map<number, number[]>();
  for (const e of all) if (wanted.has(e.documentId)) map.set(e.documentId, e.correspondentIds);
  return map;
}

/** Remplace un correspondant secondaire par un autre partout (fusion). */
export async function reassignSecondaryCorrespondent(oldId: number, newId: number): Promise<void> {
  const all = await readAll();
  let dirty = false;
  for (const e of all) {
    if (e.correspondentIds.includes(oldId)) {
      e.correspondentIds = [...new Set(e.correspondentIds.map((id) => (id === oldId ? newId : id)))];
      dirty = true;
    }
  }
  if (dirty) await writeAll(all);
}

async function setSecondary(documentId: number, ids: number[]): Promise<number[]> {
  const all = await readAll();
  const unique = [...new Set(ids)];
  const idx = all.findIndex((e) => e.documentId === documentId);
  if (unique.length === 0) {
    if (idx >= 0) { all.splice(idx, 1); await writeAll(all); }
    return [];
  }
  if (idx >= 0) all[idx].correspondentIds = unique;
  else all.push({ documentId, correspondentIds: unique });
  await writeAll(all);
  return unique;
}

export async function addSecondaryCorrespondent(documentId: number, correspondentId: number): Promise<number[]> {
  const current = await getSecondaryCorrespondents(documentId);
  return setSecondary(documentId, [...current, correspondentId]);
}

export async function removeSecondaryCorrespondent(documentId: number, correspondentId: number): Promise<number[]> {
  const current = await getSecondaryCorrespondents(documentId);
  return setSecondary(documentId, current.filter((id) => id !== correspondentId));
}
