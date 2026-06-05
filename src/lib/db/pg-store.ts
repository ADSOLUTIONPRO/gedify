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

/**
 * Lit toutes les lignes d'une table → tableau d'objets de la colonne blob (forme
 * JSON d'origine). `blobCol` = "raw" (défaut) ou "metadata" selon la table.
 */
export async function pgReadAll<T>(table: string, idCol = "id", blobCol = "raw"): Promise<T[]> {
  const pool = await getPool();
  const { rows } = await pool.query(`SELECT "${blobCol}" AS blob FROM "${table}" ORDER BY "${idCol}"`);
  return rows.map((r) => r.blob as T);
}

/**
 * Lit UNIQUEMENT les lignes dont la clé JSON `jsonKey` (lue dans la colonne blob
 * — source de vérité, toujours à jour) appartient à `ids`. Évite de transférer
 * toute la table quand on ne cible qu'une page de documents (perf Partie 9).
 *
 * On filtre sur le blob (et non sur les colonnes requêtables document_id/
 * source_document_id) car `pgWriteAll` ne maintient que `id` + blob : ces
 * colonnes peuvent être nulles après une écriture applicative. `jsonKey` est une
 * constante interne (jamais une entrée utilisateur). Sans index dédié, Postgres
 * fait un seq scan côté serveur mais ne transfère/parse que les lignes ciblées
 * (≈ une page) au lieu de toute la table — gain net réseau + CPU applicatif.
 */
export async function pgReadByJsonIds<T>(
  table: string,
  jsonKey: string,
  ids: number[],
  blobCol = "raw",
): Promise<T[]> {
  if (ids.length === 0) return [];
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT "${blobCol}" AS blob FROM "${table}" WHERE ("${blobCol}"->>'${jsonKey}')::bigint = ANY($1::bigint[])`,
    [ids],
  );
  return rows.map((r) => r.blob as T);
}

/** Colonne « requêtable » supplémentaire à renseigner à l'écriture (ex. une
 *  colonne NOT NULL comme document_ai_analyses.document_id, que le blob seul ne
 *  remplit pas → violation de contrainte). */
export type PgExtraColumn<T> = { name: string; valueOf: (item: T) => unknown };

/**
 * Remplace l'état complet d'une table : upsert de chaque élément (idCol + blob,
 * + colonnes `extraColumns` éventuelles) puis suppression des lignes absentes,
 * en transaction. `extraColumns` est rétrocompatible (optionnel).
 */
export async function pgWriteAll<T>(
  table: string,
  idCol: string,
  idOf: (item: T) => string | number | null | undefined,
  items: T[],
  blobCol = "raw",
  extraColumns?: PgExtraColumn<T>[],
): Promise<void> {
  const extras = extraColumns ?? [];
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids: (string | number)[] = [];
    // Colonnes insérées : idCol, blobCol, puis les extras. Le SET du ON CONFLICT
    // met à jour blobCol + extras (jamais idCol, clé de conflit).
    const colNames = [idCol, blobCol, ...extras.map((c) => c.name)];
    const colList = colNames.map((c) => `"${c}"`).join(", ");
    const placeholders = colNames.map((_, i) => `$${i + 1}`).join(", ");
    const updateSet = [blobCol, ...extras.map((c) => c.name)].map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
    for (const item of items) {
      const id = idOf(item);
      if (id == null || id === "") continue;
      ids.push(id);
      await client.query(
        `INSERT INTO "${table}"(${colList}) VALUES(${placeholders}) ON CONFLICT("${idCol}") DO UPDATE SET ${updateSet}`,
        [id, JSON.stringify(item), ...extras.map((c) => c.valueOf(item))],
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

/* ────────────────────────────────────────────────────────────────────────
   Variantes « avec portée » (scope/kind) : plusieurs stores partagent une même
   table, distingués par une colonne discriminante (`scope` pour signatures,
   `kind` pour mail_document_links). La suppression est CONFINÉE à la portée du
   store, donc un store n'efface jamais les lignes d'un autre store.
   ──────────────────────────────────────────────────────────────────────── */

/** Lit les lignes d'une portée donnée → tableau d'objets (colonne blob). */
export async function pgReadScoped<T>(
  table: string,
  scopeCol: string,
  scopeVal: string,
  idCol = "id",
  blobCol = "raw",
): Promise<T[]> {
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT "${blobCol}" AS blob FROM "${table}" WHERE "${scopeCol}" = $1 ORDER BY "${idCol}"`,
    [scopeVal],
  );
  return rows.map((r) => r.blob as T);
}

/** Remplace l'état complet d'UNE portée (upsert + suppression confinée). */
export async function pgWriteScoped<T>(
  table: string,
  idCol: string,
  idOf: (item: T) => string | number | null | undefined,
  items: T[],
  opts: { scopeCol: string; scopeVal: string; blobCol?: string },
): Promise<void> {
  const blobCol = opts.blobCol ?? "raw";
  const { scopeCol, scopeVal } = opts;
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
        `INSERT INTO "${table}"("${idCol}", "${scopeCol}", "${blobCol}") VALUES($1, $2, $3)
         ON CONFLICT("${idCol}") DO UPDATE SET "${scopeCol}" = EXCLUDED."${scopeCol}", "${blobCol}" = EXCLUDED."${blobCol}"`,
        [id, scopeVal, JSON.stringify(item)],
      );
    }
    if (ids.length > 0) {
      const ph = ids.map((_, i) => `$${i + 2}`).join(",");
      await client.query(
        `DELETE FROM "${table}" WHERE "${scopeCol}" = $1 AND "${idCol}" NOT IN (${ph})`,
        [scopeVal, ...ids],
      );
    } else {
      await client.query(`DELETE FROM "${table}" WHERE "${scopeCol}" = $1`, [scopeVal]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/* ────────────────────────────────────────────────────────────────────────
   document_correspondents : table de jointure (clé composite, pas de blob).
   On ne touche QUE le rôle demandé (« secondary ») ; le correspondant principal
   (rôle « primary », posé par la migration des documents) est préservé.
   ──────────────────────────────────────────────────────────────────────── */
export type DocCorrespondentEntry = { documentId: number; correspondentIds: number[] };

export async function pgReadDocCorrespondents(role: string): Promise<DocCorrespondentEntry[]> {
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT document_id, correspondent_id FROM document_correspondents WHERE role = $1 ORDER BY document_id, correspondent_id`,
    [role],
  );
  const map = new Map<number, number[]>();
  for (const r of rows) {
    const did = Number(r.document_id);
    const arr = map.get(did) ?? [];
    arr.push(Number(r.correspondent_id));
    map.set(did, arr);
  }
  return [...map.entries()].map(([documentId, correspondentIds]) => ({ documentId, correspondentIds }));
}

export async function pgWriteDocCorrespondents(
  role: string,
  entries: DocCorrespondentEntry[],
): Promise<void> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Remplace tout l'ensemble du rôle (le store écrit toujours la collection complète).
    await client.query("DELETE FROM document_correspondents WHERE role = $1", [role]);
    for (const e of entries) {
      for (const cid of [...new Set(e.correspondentIds)]) {
        // DO NOTHING : ne jamais écraser une ligne « primary » sur la même paire.
        await client.query(
          `INSERT INTO document_correspondents(document_id, correspondent_id, role) VALUES($1, $2, $3)
           ON CONFLICT(document_id, correspondent_id) DO NOTHING`,
          [e.documentId, cid, role],
        );
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
