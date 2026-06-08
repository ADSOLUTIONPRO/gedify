import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Éléments épinglés au tableau de bord (dossiers / projets), PAR UTILISATEUR.
   Stockage serveur routé (JSON / SQLite / Postgres via pg-store), comme
   project-store. Un même élément ne peut être épinglé qu'une fois par user.
   ──────────────────────────────────────────────────────────────────────── */

export type PinnedEntityType = "folder" | "project";

export type PinnedItem = {
  id: string;
  userId: string;
  entityType: PinnedEntityType;
  entityId: string;
  order: number;
  createdAt: string;
};

const COLLECTION = "pinned_items";
const JSON_FILE = "pinned-items.json";

function jsonPath() {
  return path.join(getDataDir(), JSON_FILE);
}

async function readAll(): Promise<PinnedItem[]> {
  if (pgStorageActive()) {
    try { return await pgReadAll<PinnedItem>(COLLECTION); }
    catch (e) { if (jsonFallback()) return readJson(); throw e; }
  }
  return readJson();
}

async function readJson(): Promise<PinnedItem[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PinnedItem[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(items: PinnedItem[]): Promise<void> {
  if (pgStorageActive()) { await pgWriteAll<PinnedItem>(COLLECTION, "id", (p) => p.id, items); return; }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export async function listPins(userId: string): Promise<PinnedItem[]> {
  const all = await readAll();
  return all.filter((p) => p.userId === userId).sort((a, b) => a.order - b.order || (a.createdAt < b.createdAt ? -1 : 1));
}

export async function isPinned(userId: string, entityType: PinnedEntityType, entityId: string): Promise<boolean> {
  const all = await readAll();
  return all.some((p) => p.userId === userId && p.entityType === entityType && p.entityId === entityId);
}

export async function addPin(userId: string, entityType: PinnedEntityType, entityId: string): Promise<PinnedItem> {
  const all = await readAll();
  const existing = all.find((p) => p.userId === userId && p.entityType === entityType && p.entityId === entityId);
  if (existing) return existing; // jamais de doublon
  const mine = all.filter((p) => p.userId === userId);
  const order = mine.length ? Math.max(...mine.map((p) => p.order)) + 1 : 0;
  const pin: PinnedItem = { id: randomUUID(), userId, entityType, entityId, order, createdAt: new Date().toISOString() };
  all.push(pin);
  await writeAll(all);
  return pin;
}

/** Retire une épingle par id OU par (entityType, entityId). Renvoie true si retirée. */
export async function removePin(userId: string, opts: { id?: string; entityType?: PinnedEntityType; entityId?: string }): Promise<boolean> {
  const all = await readAll();
  const before = all.length;
  const next = all.filter((p) => {
    if (p.userId !== userId) return true;
    if (opts.id) return p.id !== opts.id;
    if (opts.entityType && opts.entityId) return !(p.entityType === opts.entityType && p.entityId === opts.entityId);
    return true;
  });
  if (next.length === before) return false;
  await writeAll(next);
  return true;
}

export async function reorderPins(userId: string, orderedIds: string[]): Promise<void> {
  const all = await readAll();
  const rank = new Map(orderedIds.map((id, i) => [id, i]));
  for (const p of all) {
    if (p.userId === userId && rank.has(p.id)) p.order = rank.get(p.id)!;
  }
  await writeAll(all);
}
