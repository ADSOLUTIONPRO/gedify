import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Disposition du tableau de bord PAR UTILISATEUR (visibilité + ordre des
   widgets), persistée en base (source de vérité ; le localStorage côté client
   sert de cache). Routé JSON / SQLite / Postgres via pg-store.
   ──────────────────────────────────────────────────────────────────────── */

export type DashboardLayout = {
  id: string; // = userId (une disposition par utilisateur)
  userId: string;
  visibility: Record<string, boolean>;
  order: string[];
  updatedAt: string;
};

const COLLECTION = "dashboard_layouts";
const JSON_FILE = "dashboard-layouts.json";

function jsonPath() { return path.join(getDataDir(), JSON_FILE); }

async function readAll(): Promise<DashboardLayout[]> {
  if (pgStorageActive()) {
    try { return await pgReadAll<DashboardLayout>(COLLECTION); }
    catch (e) { if (jsonFallback()) return readJson(); throw e; }
  }
  return readJson();
}
async function readJson(): Promise<DashboardLayout[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DashboardLayout[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}
async function writeAll(items: DashboardLayout[]): Promise<void> {
  if (pgStorageActive()) { await pgWriteAll<DashboardLayout>(COLLECTION, "id", (l) => l.id, items); return; }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export async function getLayout(userId: string): Promise<DashboardLayout | null> {
  const all = await readAll();
  return all.find((l) => l.userId === userId) ?? null;
}

export async function saveLayout(userId: string, visibility: Record<string, boolean>, order: string[]): Promise<DashboardLayout> {
  const all = await readAll();
  const next: DashboardLayout = { id: userId, userId, visibility, order, updatedAt: new Date().toISOString() };
  const idx = all.findIndex((l) => l.userId === userId);
  if (idx >= 0) all[idx] = next; else all.push(next);
  await writeAll(all);
  return next;
}
