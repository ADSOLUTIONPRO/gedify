import "server-only";

import { getPrisma } from "../prisma";
import type { StorageProvider } from "./types";

/**
 * Fournisseur PostgreSQL — phase d'amorçage : stocke les collections nommées
 * dans la table `settings` (clé/valeur JSON). Cela permet d'activer Postgres de
 * façon progressive ; les repositories normalisés (documents, tags, …) viendront
 * remplacer ce KV table par table, sans changer l'interface.
 */
export const postgresStorageProvider: StorageProvider = {
  mode: "postgres",
  async read<T>(name: string, fallback: T): Promise<T> {
    const row = await getPrisma().setting.findUnique({ where: { key: name } });
    return row ? (row.value as T) : fallback;
  },
  async write<T>(name: string, data: T): Promise<void> {
    const value = JSON.parse(JSON.stringify(data ?? null));
    await getPrisma().setting.upsert({
      where: { key: name },
      create: { key: name, value },
      update: { value },
    });
  },
};
