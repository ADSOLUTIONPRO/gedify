import "server-only";

import { randomUUID } from "node:crypto";
import { readStore, writeStore } from "@/lib/engine/stores";

/* ────────────────────────────────────────────────────────────────────────
   Recherches sauvegardées (Chantier recherche avancée).

   Persistées via le store moteur clé/valeur « saved-searches » : table
   `settings` en mode postgres (incluses dans le dump/backup), JSON sinon.
   Une recherche = un nom + un jeu de paramètres d'URL de /recherche.
   ──────────────────────────────────────────────────────────────────────── */

const STORE_KEY = "saved-searches";

export type SavedSearch = {
  id: string;
  name: string;
  /** Paramètres d'URL de /recherche (query, correspondent, document_type, tag,
   *  created_from, created_to, ordering, …). */
  params: Record<string, string>;
  createdAt: string;
};

async function readAll(): Promise<SavedSearch[]> {
  const v = await readStore<SavedSearch[]>(STORE_KEY, []);
  return Array.isArray(v) ? v : [];
}

async function writeAll(items: SavedSearch[]): Promise<void> {
  await writeStore(STORE_KEY, items);
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const all = await readAll();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSavedSearch(input: {
  name: string;
  params: Record<string, string>;
}): Promise<SavedSearch> {
  const name = input.name?.trim();
  if (!name) throw new Error("Le nom de la recherche est obligatoire.");

  // Nettoie les paramètres vides / non pertinents.
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.params ?? {})) {
    if (k === "page") continue;
    const val = typeof v === "string" ? v.trim() : "";
    if (val) params[k] = val;
  }

  const all = await readAll();
  // Remplace une recherche existante du même nom (insensible à la casse).
  const filtered = all.filter((s) => s.name.toLowerCase() !== name.toLowerCase());
  const record: SavedSearch = {
    id: randomUUID(),
    name,
    params,
    createdAt: new Date().toISOString(),
  };
  filtered.push(record);
  await writeAll(filtered);
  return record;
}

export async function deleteSavedSearch(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((s) => s.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
