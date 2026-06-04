import "server-only";

import { getPool } from "@/lib/db/pg";

/* ────────────────────────────────────────────────────────────────────────
   Backend Postgres du cœur moteur (Phase 2, round 1).

   Lit/écrit les collections moteur depuis Postgres en PRÉSERVANT la forme JSON
   exacte attendue par l'app : chaque table porte une colonne `raw` (l'objet
   d'origine intégral). `readCollectionPg("documents")` renvoie donc le même
   tableau d'objets que l'ancien `documents.json` → aucun appelant à modifier.

   Round 1 : documents, tags, document_types, correspondents, custom_fields,
   counters. Les autres collections restent en JSON (repli).
   ──────────────────────────────────────────────────────────────────────── */

const TABLES: Record<string, string> = {
  documents: "documents",
  tags: "tags",
  document_types: "document_types",
  correspondents: "correspondents",
  custom_fields: "custom_fields",
  users: "users",
};

export function postgresEngineEnabled(): boolean {
  return (
    process.env.GEDIFY_STORAGE_MODE?.trim().toLowerCase() === "postgres" &&
    Boolean(process.env.DATABASE_URL)
  );
}

export function engineCollectionSupported(name: string): boolean {
  return name === "counters" || name in TABLES;
}

export function jsonFallbackEnabled(): boolean {
  return process.env.ENABLE_JSON_FALLBACK !== "false";
}

/** Lecture d'une collection moteur → même forme que le JSON d'origine. */
export async function readCollectionPg(name: string): Promise<unknown> {
  const pool = await getPool();
  if (name === "counters") {
    const { rows } = await pool.query("SELECT name, value FROM counters");
    const out: Record<string, number> = {};
    for (const r of rows) out[r.name] = Number(r.value);
    return out;
  }
  const table = TABLES[name];
  const { rows } = await pool.query(`SELECT raw FROM "${table}" ORDER BY id`);
  return rows.map((r) => r.raw);
}

/**
 * Écriture d'une collection moteur (remplacement de l'état complet, comme
 * writeStore JSON) : upsert de chaque élément (id + raw) puis suppression des
 * lignes absentes du nouvel état, en transaction.
 */
export async function writeCollectionPg(name: string, data: unknown): Promise<void> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (name === "counters") {
      const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        await client.query(
          "INSERT INTO counters(name, value) VALUES($1, $2) ON CONFLICT(name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
          [k, Number(v) || 0],
        );
      }
    } else {
      const table = TABLES[name];
      const arr = Array.isArray(data) ? data : [];
      const ids: number[] = [];
      for (const item of arr) {
        const id = Number((item as { id?: unknown })?.id);
        if (!Number.isFinite(id)) continue;
        ids.push(id);
        await client.query(
          `INSERT INTO "${table}"(id, raw) VALUES($1, $2) ON CONFLICT(id) DO UPDATE SET raw = EXCLUDED.raw`,
          [id, JSON.stringify(item)],
        );
      }
      if (ids.length > 0) {
        await client.query(`DELETE FROM "${table}" WHERE id <> ALL($1::int[])`, [ids]);
      } else {
        await client.query(`DELETE FROM "${table}"`);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Séquence d'ID atomique côté Postgres (table counters). */
export async function nextIdPg(seq: string): Promise<number> {
  const pool = await getPool();
  const { rows } = await pool.query(
    "INSERT INTO counters(name, value) VALUES($1, 1) ON CONFLICT(name) DO UPDATE SET value = counters.value + 1, updated_at = now() RETURNING value",
    [seq],
  );
  return Number(rows[0].value);
}
