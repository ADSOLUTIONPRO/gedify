import "server-only";

import { getSqlite } from "./client";

/* ────────────────────────────────────────────────────────────────────────
   Jumeaux SQLite des helpers moteur de `engine-pg.ts` (collections « raw »,
   users, counters, settings, séquences d'ID). MÊME forme JSON renvoyée que
   l'ancien store → aucun appelant moteur à changer. Mode sqlite uniquement.
   ──────────────────────────────────────────────────────────────────────── */

const TABLES: Record<string, { table: string; blob: string }> = {
  documents: { table: "documents", blob: "raw" },
  tags: { table: "tags", blob: "raw" },
  document_types: { table: "document_types", blob: "raw" },
  correspondents: { table: "correspondents", blob: "raw" },
  custom_fields: { table: "custom_fields", blob: "metadata" },
  users: { table: "users", blob: "metadata" },
};

export function sqliteReadSetting(key: string): unknown | null {
  const db = getSqlite();
  const row = db.prepare(`SELECT "value" FROM "settings" WHERE "key" = ?`).get(key) as
    | { value?: unknown }
    | undefined;
  return row?.value != null ? JSON.parse(String(row.value)) : null;
}

export function sqliteWriteSetting(key: string, value: unknown): void {
  const db = getSqlite();
  db.prepare(
    `INSERT INTO "settings"("key","value") VALUES(?,?) ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"`,
  ).run(key, JSON.stringify(value));
}

export function sqliteReadCollection(name: string): unknown {
  const db = getSqlite();
  if (name === "counters") {
    const rows = db.prepare(`SELECT "name","value" FROM "counters"`).all();
    const out: Record<string, number> = {};
    for (const r of rows) out[String(r.name)] = Number(r.value);
    return out;
  }
  if (name === "users") {
    // Le hash vit dans la colonne password_hash (hors metadata) ; on le ré-injecte
    // pour que verifyCredentials fonctionne, comme en mode postgres.
    const rows = db.prepare(`SELECT "metadata","password_hash" FROM "users" ORDER BY "id"`).all();
    return rows.map((r) => {
      const obj = { ...((r.metadata ? JSON.parse(String(r.metadata)) : {}) as Record<string, unknown>) };
      if ((obj.passwordHash == null || obj.passwordHash === "") && r.password_hash != null) {
        obj.passwordHash = String(r.password_hash);
      }
      return obj;
    });
  }
  const { table, blob } = TABLES[name];
  const rows = db.prepare(`SELECT "${blob}" AS raw FROM "${table}" ORDER BY "id"`).all();
  return rows.map((r) => JSON.parse(String(r.raw)));
}

export function sqliteWriteCollection(name: string, data: unknown): void {
  const db = getSqlite();
  db.exec("BEGIN");
  try {
    if (name === "counters") {
      const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      const up = db.prepare(
        `INSERT INTO "counters"("name","value","updated_at") VALUES(?,?,?)
         ON CONFLICT("name") DO UPDATE SET "value" = excluded."value", "updated_at" = excluded."updated_at"`,
      );
      const now = new Date().toISOString();
      for (const [k, v] of Object.entries(obj)) up.run(k, Number(v) || 0, now);
    } else if (name === "users") {
      const arr = Array.isArray(data) ? data : [];
      const ids: number[] = [];
      const up = db.prepare(
        `INSERT INTO "users"("id","username","email","password_hash","is_superuser","is_active","metadata")
         VALUES(?,?,?,?,?,?,?)
         ON CONFLICT("id") DO UPDATE SET
           "username" = excluded."username", "email" = excluded."email",
           "password_hash" = excluded."password_hash", "is_superuser" = excluded."is_superuser",
           "is_active" = excluded."is_active", "metadata" = excluded."metadata"`,
      );
      for (const item of arr) {
        const u = (item ?? {}) as Record<string, unknown>;
        const id = Number(u.id);
        if (!Number.isFinite(id)) continue;
        ids.push(id);
        up.run(
          id,
          String(u.username ?? `user-${id}`),
          (u.email as string | undefined) ?? null,
          (u.passwordHash as string | undefined) ?? null,
          u.is_superuser ? 1 : 0,
          u.is_active !== false ? 1 : 0,
          JSON.stringify(item),
        );
      }
      if (ids.length > 0) {
        const ph = ids.map(() => "?").join(",");
        db.prepare(`DELETE FROM "users" WHERE "id" NOT IN (${ph})`).run(...ids);
      } else {
        db.exec(`DELETE FROM "users"`);
      }
    } else {
      const { table, blob } = TABLES[name];
      const arr = Array.isArray(data) ? data : [];
      const ids: number[] = [];
      const up = db.prepare(
        `INSERT INTO "${table}"("id","${blob}") VALUES(?,?) ON CONFLICT("id") DO UPDATE SET "${blob}" = excluded."${blob}"`,
      );
      for (const item of arr) {
        const id = Number((item as { id?: unknown })?.id);
        if (!Number.isFinite(id)) continue;
        ids.push(id);
        up.run(id, JSON.stringify(item));
      }
      if (ids.length > 0) {
        const ph = ids.map(() => "?").join(",");
        db.prepare(`DELETE FROM "${table}" WHERE "id" NOT IN (${ph})`).run(...ids);
      } else {
        db.exec(`DELETE FROM "${table}"`);
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** Séquence d'ID atomique (table counters), équivalent de nextIdPg. */
export function sqliteNextId(seq: string): number {
  const db = getSqlite();
  const row = db
    .prepare(
      `INSERT INTO "counters"("name","value","updated_at") VALUES(?, 1, ?)
       ON CONFLICT("name") DO UPDATE SET "value" = "counters"."value" + 1, "updated_at" = excluded."updated_at"
       RETURNING "value"`,
    )
    .get(seq, new Date().toISOString()) as { value?: unknown };
  return Number(row?.value ?? 0);
}
