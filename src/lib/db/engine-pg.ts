import "server-only";

import { getPool } from "@/lib/db/pg";
import { postgresActive, sqliteActive } from "@/lib/db/pg-store";
import {
  sqliteReadSetting,
  sqliteWriteSetting,
  sqliteReadCollection,
  sqliteWriteCollection,
  sqliteNextId,
} from "@/lib/db/sqlite/engine";

/* ────────────────────────────────────────────────────────────────────────
   Backend base structurée du cœur moteur (Postgres OU SQLite).

   Lit/écrit les collections moteur en PRÉSERVANT la forme JSON exacte attendue
   par l'app : chaque table porte une colonne `raw` (l'objet d'origine intégral).
   `readCollectionPg("documents")` renvoie donc le même tableau d'objets que
   l'ancien `documents.json` → aucun appelant à modifier.

   En mode `sqlite`, chaque fonction délègue au jumeau SQLite (aucun pool pg).
   Collections branchées : documents, tags, document_types, correspondents,
   custom_fields, users, counters. Les autres restent en JSON (repli).
   ──────────────────────────────────────────────────────────────────────── */

// La colonne « blob JSON intégral » varie selon la table (raw vs metadata).
const TABLES: Record<string, { table: string; blob: string }> = {
  documents: { table: "documents", blob: "raw" },
  tags: { table: "tags", blob: "raw" },
  document_types: { table: "document_types", blob: "raw" },
  correspondents: { table: "correspondents", blob: "raw" },
  custom_fields: { table: "custom_fields", blob: "metadata" },
  users: { table: "users", blob: "metadata" },
};

export function postgresEngineEnabled(): boolean {
  return postgresActive() || sqliteActive();
}

export function engineCollectionSupported(name: string): boolean {
  return name === "counters" || name in TABLES;
}

export function jsonFallbackEnabled(): boolean {
  return process.env.ENABLE_JSON_FALLBACK !== "false";
}

/* ── Réglages clé/valeur (table settings) ──────────────────────────────────
   Certains stores moteur sont des OBJETS (pas des tableaux) persistés via
   readStore/writeStore. Seules les clés listées ici vivent dans `settings`. */
const SETTINGS_KEYS = new Set<string>(["assistant-settings", "saved-searches", "audit-log", "feature-flags"]);

export function engineSettingSupported(name: string): boolean {
  return SETTINGS_KEYS.has(name);
}

/** Lit la valeur (objet JSON) d'un réglage, ou null si absent. */
export async function readSettingPg(key: string): Promise<unknown | null> {
  if (sqliteActive()) return sqliteReadSetting(key);
  const pool = await getPool();
  const { rows } = await pool.query("SELECT value FROM settings WHERE key = $1", [key]);
  return rows.length ? rows[0].value : null;
}

/** Upsert d'un réglage clé/valeur. */
export async function writeSettingPg(key: string, value: unknown): Promise<void> {
  if (sqliteActive()) return sqliteWriteSetting(key, value);
  const pool = await getPool();
  await pool.query(
    "INSERT INTO settings(key, value) VALUES($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
    [key, JSON.stringify(value)],
  );
}

/** Lecture d'une collection moteur → même forme que le JSON d'origine. */
export async function readCollectionPg(name: string): Promise<unknown> {
  if (sqliteActive()) return sqliteReadCollection(name);
  const pool = await getPool();
  if (name === "counters") {
    const { rows } = await pool.query("SELECT name, value FROM counters");
    const out: Record<string, number> = {};
    for (const r of rows) out[r.name] = Number(r.value);
    return out;
  }
  if (name === "users") {
    // Le migrateur a stocké le hash dans la colonne password_hash (hors metadata).
    // On le ré-injecte pour que verifyCredentials fonctionne en mode postgres.
    const { rows } = await pool.query(
      'SELECT metadata, password_hash FROM users ORDER BY id',
    );
    return rows.map((r) => {
      const obj = { ...((r.metadata ?? {}) as Record<string, unknown>) };
      if ((obj.passwordHash == null || obj.passwordHash === "") && r.password_hash != null) {
        obj.passwordHash = r.password_hash;
      }
      return obj;
    });
  }
  const { table, blob } = TABLES[name];
  const { rows } = await pool.query(`SELECT "${blob}" AS raw FROM "${table}" ORDER BY id`);
  return rows.map((r) => r.raw);
}

/**
 * Écriture d'une collection moteur (remplacement de l'état complet, comme
 * writeStore JSON) : upsert de chaque élément (id + raw) puis suppression des
 * lignes absentes du nouvel état, en transaction.
 */
export async function writeCollectionPg(name: string, data: unknown): Promise<void> {
  if (sqliteActive()) return sqliteWriteCollection(name, data);
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
    } else if (name === "users") {
      // users.username est NOT NULL (et password_hash vit dans sa colonne, lue par
      // readCollectionPg) : on renseigne les colonnes explicites EN PLUS du blob.
      // Sans cela, INSERT(id, metadata) viole la contrainte → « Erreur serveur »
      // à la création du compte admin.
      const arr = Array.isArray(data) ? data : [];
      const ids: number[] = [];
      for (const item of arr) {
        const u = (item ?? {}) as Record<string, unknown>;
        const id = Number(u.id);
        if (!Number.isFinite(id)) continue;
        ids.push(id);
        await client.query(
          `INSERT INTO "users"(id, username, email, password_hash, is_superuser, is_active, metadata)
           VALUES($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT(id) DO UPDATE SET
             username = EXCLUDED.username, email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash, is_superuser = EXCLUDED.is_superuser,
             is_active = EXCLUDED.is_active, metadata = EXCLUDED.metadata`,
          [
            id,
            String(u.username ?? `user-${id}`),
            (u.email as string | undefined) ?? null,
            (u.passwordHash as string | undefined) ?? null,
            Boolean(u.is_superuser),
            u.is_active !== false,
            JSON.stringify(item),
          ],
        );
      }
      if (ids.length > 0) {
        await client.query(`DELETE FROM "users" WHERE id <> ALL($1::int[])`, [ids]);
      } else {
        await client.query(`DELETE FROM "users"`);
      }
    } else {
      const { table, blob } = TABLES[name];
      const arr = Array.isArray(data) ? data : [];
      const ids: number[] = [];
      for (const item of arr) {
        const id = Number((item as { id?: unknown })?.id);
        if (!Number.isFinite(id)) continue;
        ids.push(id);
        await client.query(
          `INSERT INTO "${table}"(id, "${blob}") VALUES($1, $2) ON CONFLICT(id) DO UPDATE SET "${blob}" = EXCLUDED."${blob}"`,
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

/** Séquence d'ID atomique côté base structurée (table counters). */
export async function nextIdPg(seq: string): Promise<number> {
  if (sqliteActive()) return sqliteNextId(seq);
  const pool = await getPool();
  const { rows } = await pool.query(
    "INSERT INTO counters(name, value) VALUES($1, 1) ON CONFLICT(name) DO UPDATE SET value = counters.value + 1, updated_at = now() RETURNING value",
    [seq],
  );
  return Number(rows[0].value);
}
