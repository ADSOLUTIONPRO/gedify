import "server-only";

import { getPool } from "@/lib/db/pg";

/* ────────────────────────────────────────────────────────────────────────
   Sauvegarde / restauration LOGIQUE de PostgreSQL (Chantier 5).

   En mode `postgres`, les domaines (projets, budget, mails, contacts, …) vivent
   en base, pas dans les JSON du data-dir. Pour une sauvegarde COMPLÈTE, on dump
   toutes les tables publiques (lignes intégrales) en JSON, et on restaure par
   DELETE + INSERT (le schéma n'a AUCUNE clé étrangère → ordre indifférent).

   Pur JS via le pool `pg` : aucun binaire (pas de pg_dump) requis.
   ──────────────────────────────────────────────────────────────────────── */

export type PgDump = {
  generatedAt: string;
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
};

async function listPublicTables(): Promise<string[]> {
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  return rows
    .map((r) => String(r.tablename))
    .filter((t) => !t.startsWith("_")); // ignore tables techniques éventuelles
}

/** Dump complet de la base (toutes les tables publiques). */
export async function dumpPostgres(): Promise<PgDump> {
  const pool = await getPool();
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of await listPublicTables()) {
    const { rows } = await pool.query(`SELECT * FROM "${table}"`);
    tables[table] = rows;
    counts[table] = rows.length;
  }
  return { generatedAt: new Date().toISOString(), tables, counts };
}

/** Valeur prête pour un bind pg : objet/tableau → JSON, sinon tel quel. */
function bindValue(v: unknown): unknown {
  if (v !== null && typeof v === "object" && !(v instanceof Date)) {
    return JSON.stringify(v);
  }
  return v;
}

/**
 * Restaure un dump : pour chaque table, DELETE puis INSERT des lignes, en
 * transaction par table. Idempotent (l'état final = le dump). Une table absente
 * du schéma cible est ignorée avec une erreur consignée.
 */
export async function restorePostgres(
  dump: PgDump,
): Promise<{ restored: Record<string, number>; errors: string[] }> {
  const pool = await getPool();
  const restored: Record<string, number> = {};
  const errors: string[] = [];

  for (const [table, rows] of Object.entries(dump.tables)) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM "${table}"`);
      let n = 0;
      for (const row of rows as Record<string, unknown>[]) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const colList = cols.map((c) => `"${c}"`).join(", ");
        const values = cols.map((c) => bindValue(row[c]));
        await client.query(
          `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
          values,
        );
        n += 1;
      }
      await client.query("COMMIT");
      restored[table] = n;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      errors.push(`Table ${table} : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      client.release();
    }
  }

  return { restored, errors };
}
