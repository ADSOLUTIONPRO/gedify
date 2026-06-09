import "server-only";

import { getPool } from "@/lib/db/pg";
import {
  sqliteReadAll,
  sqliteReadByJsonIds,
  sqliteWriteAll,
  sqliteUpsertOne,
  sqliteDeleteOne,
  sqliteReadScoped,
  sqliteWriteScoped,
  sqliteReadDocCorrespondents,
  sqliteWriteDocCorrespondents,
} from "@/lib/db/sqlite/store";

/* ────────────────────────────────────────────────────────────────────────
   Helper générique pour brancher un store « collection JSON » sur une base
   structurée (Postgres OU SQLite). Chaque table porte une colonne blob (`raw`/
   `metadata`) reprenant l'objet d'origine intégral, donc `pgReadAll` renvoie la
   MÊME forme que l'ancien tableau JSON → aucun appelant à changer. `pgWriteAll`
   remplace l'état complet (upsert + suppression des lignes absentes).

   Routage : en mode `sqlite`, chaque fonction délègue à son jumeau SQLite (aucun
   pool Postgres ouvert). En mode `postgres`, on utilise le pool pg. On ne
   MÉLANGE jamais les deux backends.
   ──────────────────────────────────────────────────────────────────────── */

/** Mode de stockage déclaré (`json` par défaut). */
export function getStorageMode(): "postgres" | "sqlite" | "json" {
  const m = process.env.GEDIFY_STORAGE_MODE?.trim().toLowerCase();
  return m === "postgres" || m === "sqlite" ? m : "json";
}

/** Postgres réellement actif (nécessite le pool pg + DATABASE_URL). */
export function postgresActive(): boolean {
  return getStorageMode() === "postgres" && Boolean(process.env.DATABASE_URL);
}

/** SQLite réellement actif (fichier local `gedify.sqlite`). */
export function sqliteActive(): boolean {
  return getStorageMode() === "sqlite";
}

/**
 * Stockage STRUCTURÉ actif (Postgres OU SQLite) : vrai dès qu'un store doit
 * passer par la base plutôt que par les fichiers JSON. Les stores branchés
 * testent ce drapeau ; le routage interne (postgres vs sqlite) est transparent.
 */
export function pgStorageActive(): boolean {
  return postgresActive() || sqliteActive();
}

export function jsonFallback(): boolean {
  return process.env.ENABLE_JSON_FALLBACK !== "false";
}

/**
 * Lit toutes les lignes d'une table → tableau d'objets de la colonne blob (forme
 * JSON d'origine). `blobCol` = "raw" (défaut) ou "metadata" selon la table.
 */
export async function pgReadAll<T>(table: string, idCol = "id", blobCol = "raw"): Promise<T[]> {
  if (sqliteActive()) return sqliteReadAll<T>(table, idCol, blobCol);
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
  if (sqliteActive()) return sqliteReadByJsonIds<T>(table, jsonKey, ids, blobCol);
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
  if (sqliteActive()) return sqliteWriteAll<T>(table, idCol, idOf, items, blobCol, extraColumns);
  const extras = extraColumns ?? [];
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Auto-création de la table si absente (collections récentes non présentes
    // dans le schéma init.sql — ex. pinned_items, calendar_events, caldav_accounts).
    // Idempotent : n'affecte JAMAIS une table existante (IF NOT EXISTS).
    const extraDefs = extras.map((c) => `, "${c.name}" TEXT`).join("");
    await client.query(`CREATE TABLE IF NOT EXISTS "${table}" ("${idCol}" TEXT PRIMARY KEY, "${blobCol}" JSONB${extraDefs})`);
    for (const c of extras) {
      await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${c.name}" TEXT`);
    }
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

/**
 * Upsert d'UN SEUL enregistrement, par sa clé — SANS jamais supprimer ni
 * réécrire les autres lignes. À utiliser pour les collections où chaque ligne
 * est indépendante (comptes mail, tokens OAuth) : garantit qu'écrire/mettre à
 * jour un compte ne peut pas affecter les autres (contrairement à `pgWriteAll`
 * qui remplace l'état complet et SUPPRIME les lignes absentes du tableau).
 */
export async function pgUpsertOne<T>(
  table: string,
  idCol: string,
  id: string | number,
  item: T,
  blobCol = "raw",
): Promise<void> {
  if (sqliteActive()) return sqliteUpsertOne<T>(table, idCol, id, item, blobCol);
  const pool = await getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS "${table}" ("${idCol}" TEXT PRIMARY KEY, "${blobCol}" JSONB)`);
  await pool.query(
    `INSERT INTO "${table}"("${idCol}", "${blobCol}") VALUES($1, $2) ON CONFLICT("${idCol}") DO UPDATE SET "${blobCol}" = EXCLUDED."${blobCol}"`,
    [id, JSON.stringify(item)],
  );
}

/** Supprime UNE SEULE ligne par sa clé — sans toucher aux autres. */
export async function pgDeleteOne(table: string, idCol: string, id: string | number): Promise<void> {
  if (sqliteActive()) return sqliteDeleteOne(table, idCol, id);
  const pool = await getPool();
  await pool.query(`DELETE FROM "${table}" WHERE "${idCol}" = $1`, [id]);
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
  if (sqliteActive()) return sqliteReadScoped<T>(table, scopeCol, scopeVal, idCol, blobCol);
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
  if (sqliteActive()) return sqliteWriteScoped<T>(table, idCol, idOf, items, opts);
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
  if (sqliteActive()) return sqliteReadDocCorrespondents(role);
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
  if (sqliteActive()) return sqliteWriteDocCorrespondents(role, entries);
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
