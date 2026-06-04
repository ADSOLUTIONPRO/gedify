import "server-only";

import type { StorageMode, StorageProvider } from "./types";
import { jsonStorageProvider } from "./json-provider";
import { postgresStorageProvider } from "./postgres-provider";

export type { StorageProvider, StorageMode } from "./types";

export function getStorageMode(): StorageMode {
  const m = process.env.GEDIFY_STORAGE_MODE?.trim().toLowerCase();
  if (m === "postgres" || m === "sqlite") return m;
  return "json";
}

/**
 * Sélectionne le fournisseur de stockage actif.
 *
 * - Défaut : JSON (aucun changement de comportement).
 * - `postgres` : seulement si DATABASE_URL est présent ; sinon, si
 *   ENABLE_JSON_FALLBACK !== "false", on retombe sur JSON (sécurité).
 * - `sqlite` : prévu plus tard (apps locales macOS/Windows) → JSON pour l'instant.
 */
export function getStorageProvider(): StorageProvider {
  const mode = getStorageMode();
  const jsonFallback = process.env.ENABLE_JSON_FALLBACK !== "false";

  if (mode === "postgres") {
    if (process.env.DATABASE_URL) return postgresStorageProvider;
    if (!jsonFallback) throw new Error("GEDIFY_STORAGE_MODE=postgres mais DATABASE_URL absente et fallback JSON désactivé.");
  }
  // sqlite à venir.
  return jsonStorageProvider;
}
