import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Vues documentaires enregistrées PAR UTILISATEUR : un ensemble de filtres de
   l'espace Documents (stocké comme query string compacte) réouvrable d'un clic.
   Routé JSON / SQLite / Postgres via pg-store.
   ──────────────────────────────────────────────────────────────────────── */

export type SavedDocumentView = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  /** Query string des filtres Documents (ex. "tab=favoris&tag=3&ordering=-added"). */
  query: string;
  icon: string | null;
  color: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

const COLLECTION = "saved_document_views";
const JSON_FILE = "saved-document-views.json";

function jsonPath() { return path.join(getDataDir(), JSON_FILE); }

async function readAll(): Promise<SavedDocumentView[]> {
  if (pgStorageActive()) {
    try { return await pgReadAll<SavedDocumentView>(COLLECTION); }
    catch (e) { if (jsonFallback()) return readJson(); throw e; }
  }
  return readJson();
}
async function readJson(): Promise<SavedDocumentView[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedDocumentView[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}
async function writeAll(items: SavedDocumentView[]): Promise<void> {
  if (pgStorageActive()) { await pgWriteAll<SavedDocumentView>(COLLECTION, "id", (v) => v.id, items); return; }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export async function listViews(userId: string): Promise<SavedDocumentView[]> {
  const all = await readAll();
  return all.filter((v) => v.userId === userId).sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

export async function createView(userId: string, input: { name: string; query: string; description?: string | null; icon?: string | null; color?: string | null; isPinned?: boolean }): Promise<SavedDocumentView> {
  const now = new Date().toISOString();
  const view: SavedDocumentView = {
    id: randomUUID(), userId,
    name: input.name.trim() || "Vue sans nom",
    description: input.description ?? null,
    query: input.query.replace(/^\?/, ""),
    icon: input.icon ?? null, color: input.color ?? null,
    isPinned: input.isPinned ?? false,
    createdAt: now, updatedAt: now,
  };
  const all = await readAll();
  all.push(view);
  await writeAll(all);
  return view;
}

export async function updateView(userId: string, id: string, patch: Partial<Pick<SavedDocumentView, "name" | "description" | "query" | "isPinned" | "icon" | "color">>): Promise<SavedDocumentView | null> {
  const all = await readAll();
  const idx = all.findIndex((v) => v.id === id);
  if (idx === -1 || all[idx].userId !== userId) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[idx];
}

export async function deleteView(userId: string, id: string): Promise<boolean> {
  const all = await readAll();
  const target = all.find((v) => v.id === id);
  if (!target || target.userId !== userId) return false;
  await writeAll(all.filter((v) => v.id !== id));
  return true;
}
