import "server-only";

import type { Pool } from "pg";

/**
 * Pool PostgreSQL de l'application (mode GEDIFY_STORAGE_MODE=postgres).
 * `pg` brut (pas le client Prisma) → pur JS, aucun WASM/binaire natif à
 * empaqueter. Import dynamique : `pg` n'est chargé qu'en mode postgres.
 */
let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL manquante (requise en mode postgres).");
    }
    const pg = await import("pg");
    pool = new pg.Pool({ connectionString, max: 5 });
  }
  return pool;
}
