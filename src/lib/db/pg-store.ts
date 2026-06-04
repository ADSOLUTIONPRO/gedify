import "server-only";

import { getPool } from "@/lib/db/pg";

/* ────────────────────────────────────────────────────────────────────────
   Helper générique pour brancher un store « collection JSON » sur Postgres
   (Phase 2). Chaque table porte une colonne `raw` (objet d'origine intégral),
   donc `pgReadAll` renvoie la MÊME forme que l'ancien tableau JSON → aucun
   appelant à changer. `pgWriteAll` remplace l'état complet (upsert + suppression
   des lignes absentes), comme un writeAll JSON.
   ──────────────────────────────────────────────────────────────────────── */

export function pgStorageActive(): boolean {
  return (
    process.env.GEDIFY_STORAGE_MODE?.trim().toLowerCase() === "postgres" &&
    Boolean(process.env.DATABASE_URL)
  );
}

export function jsonFallback(): boolean {
  return process.env.ENABLE_JSON_FALLBACK !== "false";
}

/** Lit toutes les lignes d'une table → tableau d'objets `raw` (forme JSON d'origine). */
export async function pgReadAll<T>(table: string, idCol = "id"): Promise<T[]> {
  const pool = await getPool();
  const { rows } = await pool.query(`SELECT raw FROM "${table}" ORDER BY "${idCol}"`);
  return rows.map((r) => r.raw as T);
}

/**
 * Remplace l'état complet d'une table : upsert de chaque élément (idCol + raw)
 * puis suppression des lignes absentes, en transaction.
 */
export async function pgWriteAll<T>(
  table: string,
  idCol: string,
  idOf: (item: T) => string | number | null | undefined,
  items: T[],
): Promise<void> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids: (string | number)[] = [];
    for (const item of items) {
      const id = idOf(item);
      if (id == null || id === "") continue;
      ids.push(id);
      await client.query(
        `INSERT INTO "${table}"("${idCol}", raw) VALUES($1, $2) ON CONFLICT("${idCol}") DO UPDATE SET raw = EXCLUDED.raw`,
        [id, JSON.stringify(item)],
      );
    }
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
      await client.query(`DELETE FROM "${table}" WHERE "${idCol}" NOT IN (${placeholders})`, ids);
    } else {
      await client.query(`DELETE FROM "${table}"`);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
