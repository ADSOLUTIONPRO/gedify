import "server-only";

import { readStore, writeStore } from "@/lib/engine/stores";
import type { StorageProvider } from "./types";

/**
 * Fournisseur JSON : délègue aux stores fichiers existants (source de vérité
 * actuelle). C'est le mode par défaut — rien ne change tant que la bascule
 * Postgres n'est pas validée.
 */
export const jsonStorageProvider: StorageProvider = {
  mode: "json",
  read<T>(name: string, fallback: T): Promise<T> {
    return readStore<T>(name, fallback);
  },
  write<T>(name: string, data: T): Promise<void> {
    return writeStore<T>(name, data);
  },
};
