/* Helpers communs aux scripts Gedify (inspect / backup / migrate).
   Lisent les JSON DIRECTEMENT sur disque (pas d'import des modules serveur de
   l'app), pour rester découplés et exécutables via tsx. */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** Répertoire des données JSON (ordre : JSON_DATA_DIR > DATA_DIR > APP_DATA_DIR > ./.data). */
export function dataDir(): string {
  return (
    process.env.JSON_DATA_DIR?.trim() ||
    process.env.DATA_DIR?.trim() ||
    process.env.APP_DATA_DIR?.trim() ||
    path.join(process.cwd(), ".data")
  );
}

const SKIP_DIRS = new Set(["backups", "node_modules", ".next", ".git", "media", "tessdata"]);

/** Liste récursive des fichiers .json sous `root` (en excluant backups/, media/, …). */
export function findJsonFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
      } else if (name.endsWith(".json")) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

/** Trouve un fichier JSON par nom de base, n'importe où sous le data-dir. */
export function findByBasename(root: string, basename: string): string | null {
  return findJsonFiles(root).find((f) => path.basename(f) === basename) ?? null;
}

export type LoadResult = { ok: true; data: unknown } | { ok: false; error: string };

export function loadJson(file: string): LoadResult {
  try {
    return { ok: true, data: JSON.parse(readFileSync(file, "utf8")) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Charge un tableau JSON par nom de base ([] si absent/invalide/non-tableau). */
export function loadArray<T = Record<string, unknown>>(root: string, basename: string): T[] {
  const file = findByBasename(root, basename);
  if (!file) return [];
  const res = loadJson(file);
  return res.ok && Array.isArray(res.data) ? (res.data as T[]) : [];
}

export function entryCount(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") return Object.keys(data as object).length;
  return data == null ? 0 : 1;
}

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/** Parse une date ISO en Date (ou null si invalide). */
export function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
