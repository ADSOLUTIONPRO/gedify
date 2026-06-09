import "server-only";

import { getSqlite, type SqliteDatabase } from "./client";

/* ────────────────────────────────────────────────────────────────────────
   Jumeaux SQLite des helpers `pg-store.ts`. MÊMES signatures (au synchronisme
   près : `node:sqlite` est synchrone) → `pg-store` peut router vers ces
   fonctions sans qu'aucun store appelant ne change. Chaque table porte `id` +
   une colonne blob JSON (TEXT) ; on (dé)sérialise en JSON.parse/JSON.stringify
   (l'équivalent du jsonb Postgres). On ne mélange JAMAIS les backends : ces
   fonctions ne sont appelées qu'en mode `GEDIFY_STORAGE_MODE=sqlite`.
   ──────────────────────────────────────────────────────────────────────── */

export type SqliteExtraColumn<T> = { name: string; valueOf: (item: T) => unknown };
export type DocCorrespondentEntry = { documentId: number; correspondentIds: number[] };

/** `node:sqlite` n'accepte que null/number/bigint/string/Uint8Array → normalise. */
function bind(v: unknown): null | number | bigint | string | Uint8Array {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "string") return v;
  if (v instanceof Uint8Array) return v;
  return JSON.stringify(v);
}

function tableExists(db: SqliteDatabase, table: string): boolean {
  return Boolean(
    db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table),
  );
}

/** Garantit la table + les colonnes nécessaires (création paresseuse défensive). */
function ensureTable(
  db: SqliteDatabase,
  table: string,
  idCol: string,
  cols: string[],
): void {
  const defs = [`"${idCol}" PRIMARY KEY`, ...cols.map((c) => `"${c}"`)];
  db.exec(`CREATE TABLE IF NOT EXISTS "${table}" (${defs.join(", ")})`);
  const existing = new Set(
    db.prepare(`PRAGMA table_info("${table}")`).all().map((r) => String(r.name)),
  );
  for (const c of cols) {
    if (!existing.has(c)) db.exec(`ALTER TABLE "${table}" ADD COLUMN "${c}"`);
  }
}

export function sqliteReadAll<T>(table: string, idCol = "id", blobCol = "raw"): T[] {
  const db = getSqlite();
  if (!tableExists(db, table)) return [];
  const rows = db.prepare(`SELECT "${blobCol}" AS blob FROM "${table}" ORDER BY "${idCol}"`).all();
  return rows.map((r) => JSON.parse(String(r.blob)) as T);
}

/** Upsert d'UNE seule ligne — ne touche jamais aux autres (isolation par ligne). */
export function sqliteUpsertOne<T>(table: string, idCol: string, id: string | number, item: T, blobCol = "raw"): void {
  const db = getSqlite();
  ensureTable(db, table, idCol, [blobCol]);
  db.prepare(
    `INSERT INTO "${table}"("${idCol}", "${blobCol}") VALUES(?, ?) ON CONFLICT("${idCol}") DO UPDATE SET "${blobCol}" = excluded."${blobCol}"`,
  ).run(bind(id), JSON.stringify(item));
}

/** Suppression d'UNE seule ligne — ne touche jamais aux autres. */
export function sqliteDeleteOne(table: string, idCol: string, id: string | number): void {
  const db = getSqlite();
  if (!tableExists(db, table)) return;
  db.prepare(`DELETE FROM "${table}" WHERE "${idCol}" = ?`).run(bind(id));
}

export function sqliteReadByJsonIds<T>(
  table: string,
  jsonKey: string,
  ids: number[],
  blobCol = "raw",
): T[] {
  if (ids.length === 0) return [];
  const db = getSqlite();
  if (!tableExists(db, table)) return [];
  const ph = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT "${blobCol}" AS blob FROM "${table}" WHERE CAST(json_extract("${blobCol}", '$.${jsonKey}') AS INTEGER) IN (${ph})`,
    )
    .all(...ids);
  return rows.map((r) => JSON.parse(String(r.blob)) as T);
}

export function sqliteWriteAll<T>(
  table: string,
  idCol: string,
  idOf: (item: T) => string | number | null | undefined,
  items: T[],
  blobCol = "raw",
  extraColumns?: SqliteExtraColumn<T>[],
): void {
  const extras = extraColumns ?? [];
  const db = getSqlite();
  ensureTable(db, table, idCol, [blobCol, ...extras.map((c) => c.name)]);
  const colNames = [idCol, blobCol, ...extras.map((c) => c.name)];
  const colList = colNames.map((c) => `"${c}"`).join(", ");
  const placeholders = colNames.map(() => "?").join(", ");
  const updateSet = [blobCol, ...extras.map((c) => c.name)]
    .map((c) => `"${c}" = excluded."${c}"`)
    .join(", ");
  const upsert = db.prepare(
    `INSERT INTO "${table}"(${colList}) VALUES(${placeholders}) ON CONFLICT("${idCol}") DO UPDATE SET ${updateSet}`,
  );
  db.exec("BEGIN");
  try {
    const ids: (string | number)[] = [];
    for (const item of items) {
      const id = idOf(item);
      if (id == null || id === "") continue;
      ids.push(id);
      upsert.run(bind(id), JSON.stringify(item), ...extras.map((c) => bind(c.valueOf(item))));
    }
    if (ids.length > 0) {
      const ph = ids.map(() => "?").join(",");
      db.prepare(`DELETE FROM "${table}" WHERE "${idCol}" NOT IN (${ph})`).run(...ids.map(bind));
    } else {
      db.exec(`DELETE FROM "${table}"`);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function sqliteReadScoped<T>(
  table: string,
  scopeCol: string,
  scopeVal: string,
  idCol = "id",
  blobCol = "raw",
): T[] {
  const db = getSqlite();
  if (!tableExists(db, table)) return [];
  const rows = db
    .prepare(
      `SELECT "${blobCol}" AS blob FROM "${table}" WHERE "${scopeCol}" = ? ORDER BY "${idCol}"`,
    )
    .all(scopeVal);
  return rows.map((r) => JSON.parse(String(r.blob)) as T);
}

export function sqliteWriteScoped<T>(
  table: string,
  idCol: string,
  idOf: (item: T) => string | number | null | undefined,
  items: T[],
  opts: { scopeCol: string; scopeVal: string; blobCol?: string },
): void {
  const blobCol = opts.blobCol ?? "raw";
  const { scopeCol, scopeVal } = opts;
  const db = getSqlite();
  ensureTable(db, table, idCol, [scopeCol, blobCol]);
  const upsert = db.prepare(
    `INSERT INTO "${table}"("${idCol}", "${scopeCol}", "${blobCol}") VALUES(?, ?, ?)
     ON CONFLICT("${idCol}") DO UPDATE SET "${scopeCol}" = excluded."${scopeCol}", "${blobCol}" = excluded."${blobCol}"`,
  );
  db.exec("BEGIN");
  try {
    const ids: (string | number)[] = [];
    for (const item of items) {
      const id = idOf(item);
      if (id == null || id === "") continue;
      ids.push(id);
      upsert.run(bind(id), scopeVal, JSON.stringify(item));
    }
    if (ids.length > 0) {
      const ph = ids.map(() => "?").join(",");
      db.prepare(
        `DELETE FROM "${table}" WHERE "${scopeCol}" = ? AND "${idCol}" NOT IN (${ph})`,
      ).run(scopeVal, ...ids.map(bind));
    } else {
      db.prepare(`DELETE FROM "${table}" WHERE "${scopeCol}" = ?`).run(scopeVal);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function sqliteReadDocCorrespondents(role: string): DocCorrespondentEntry[] {
  const db = getSqlite();
  if (!tableExists(db, "document_correspondents")) return [];
  const rows = db
    .prepare(
      `SELECT document_id, correspondent_id FROM document_correspondents WHERE role = ? ORDER BY document_id, correspondent_id`,
    )
    .all(role);
  const map = new Map<number, number[]>();
  for (const r of rows) {
    const did = Number(r.document_id);
    const arr = map.get(did) ?? [];
    arr.push(Number(r.correspondent_id));
    map.set(did, arr);
  }
  return [...map.entries()].map(([documentId, correspondentIds]) => ({ documentId, correspondentIds }));
}

export function sqliteWriteDocCorrespondents(role: string, entries: DocCorrespondentEntry[]): void {
  const db = getSqlite();
  // La table (PK composite document_id+correspondent_id) est garantie par la
  // migration 001 exécutée à l'ouverture — pas de création paresseuse ici.
  const insert = db.prepare(
    `INSERT INTO document_correspondents(document_id, correspondent_id, role) VALUES(?, ?, ?)
     ON CONFLICT(document_id, correspondent_id) DO NOTHING`,
  );
  db.exec("BEGIN");
  try {
    // Remplace tout l'ensemble du rôle (le store écrit toujours la collection complète).
    db.prepare(`DELETE FROM document_correspondents WHERE role = ?`).run(role);
    for (const e of entries) {
      for (const cid of [...new Set(e.correspondentIds)]) {
        insert.run(e.documentId, cid, role);
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
