// ─────────────────────────────────────────────────────────────────────────────
// Bibliothèque partagée des scripts SQLite Gedify (init / inspect / migration).
//
// Autonome (pur Node + node:sqlite), exécutable dans l'image Docker standalone
// SANS TypeScript. Le SCHÉMA et la CARTE des collections DOIVENT rester
// synchronisés avec `src/lib/db/sqlite/client.ts` et les stores applicatifs.
// On n'utilise QUE `CREATE TABLE IF NOT EXISTS` / upsert → ré-exécution sans
// effet, jamais d'écrasement d'une base ni de suppression de données.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

/** DATA_DIR ?? APP_DATA_DIR ?? <cwd>/.data (identique à l'app). */
export function resolveDataDir() {
  const fromEnv = process.env.DATA_DIR ?? process.env.APP_DATA_DIR;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return path.join(process.cwd(), ".data");
}

/** Chemin du fichier gedify.sqlite (DATABASE_URL=file:… ou <DATA_DIR>/gedify.sqlite). */
export function resolveDbPath() {
  const raw = process.env.DATABASE_URL?.trim();
  if (raw) {
    if (/^file:/i.test(raw)) {
      const p = raw.replace(/^file:(\/\/)?/i, "");
      if (p) return path.isAbsolute(p) ? p : path.join(resolveDataDir(), p);
    } else if (!raw.includes("://")) {
      return path.isAbsolute(raw) ? raw : path.join(resolveDataDir(), raw);
    }
  }
  return path.join(resolveDataDir(), "gedify.sqlite");
}

// ⚠️ Garder identique à MIGRATIONS[0].sql de src/lib/db/sqlite/client.ts
export const MIGRATIONS = [
  {
    name: "001_initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS "documents"        ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "tags"             ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "document_types"   ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "correspondents"   ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "custom_fields"    ("id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "users" (
        "id" PRIMARY KEY, "username" TEXT NOT NULL, "email" TEXT, "password_hash" TEXT,
        "is_superuser" INTEGER DEFAULT 0, "is_active" INTEGER DEFAULT 1, "metadata" TEXT
      );
      CREATE TABLE IF NOT EXISTS "counters"  ("name" TEXT PRIMARY KEY, "value" INTEGER NOT NULL DEFAULT 0, "updated_at" TEXT);
      CREATE TABLE IF NOT EXISTS "settings"  ("key" TEXT PRIMARY KEY, "value" TEXT);
      CREATE TABLE IF NOT EXISTS "document_correspondents" (
        "document_id" INTEGER NOT NULL, "correspondent_id" INTEGER NOT NULL, "role" TEXT NOT NULL,
        PRIMARY KEY ("document_id", "correspondent_id")
      );
      CREATE TABLE IF NOT EXISTS "document_ai_analyses"    ("id" PRIMARY KEY, "raw" TEXT, "document_id" INTEGER);
      CREATE TABLE IF NOT EXISTS "document_ai_suggestions" ("id" PRIMARY KEY, "raw_payload" TEXT);
      CREATE TABLE IF NOT EXISTS "learned_templates"       ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "document_title_overrides" ("document_id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "budget_entries" ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "reminders"      ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "tasks"          ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "folders" ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "signatures" ("id" PRIMARY KEY, "scope" TEXT, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "mail_accounts"     ("id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "mail_oauth_tokens" ("id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "mails"             ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "email_contacts"    ("id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "hidden_senders"    ("id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "saved_signatures"  ("id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "mail_document_links" ("id" PRIMARY KEY, "kind" TEXT, "raw" TEXT);
      CREATE INDEX IF NOT EXISTS "idx_ai_analyses_doc"  ON "document_ai_analyses" ("document_id");
      CREATE INDEX IF NOT EXISTS "idx_signatures_scope" ON "signatures" ("scope");
      CREATE INDEX IF NOT EXISTS "idx_links_kind"       ON "mail_document_links" ("kind");
      CREATE INDEX IF NOT EXISTS "idx_doc_corr_role"    ON "document_correspondents" ("role");
    `,
  },
];

/** Liste de toutes les tables déclarées (pour inspect). */
export const ALL_TABLES = [
  "documents", "tags", "document_types", "correspondents", "custom_fields", "users",
  "counters", "settings", "document_correspondents", "document_ai_analyses",
  "document_ai_suggestions", "learned_templates", "document_title_overrides",
  "budget_entries", "reminders", "tasks", "folders", "signatures", "mail_accounts",
  "mail_oauth_tokens", "mails", "email_contacts", "hidden_senders", "saved_signatures",
  "mail_document_links",
];

/** Collections moteur (sous <DATA_DIR>/engine/<name>.json). */
export const ENGINE_COLLECTIONS = [
  { file: ["engine", "documents.json"], table: "documents", blobCol: "raw", kind: "collection" },
  { file: ["engine", "tags.json"], table: "tags", blobCol: "raw", kind: "collection" },
  { file: ["engine", "correspondents.json"], table: "correspondents", blobCol: "raw", kind: "collection" },
  { file: ["engine", "document_types.json"], table: "document_types", blobCol: "raw", kind: "collection" },
  { file: ["engine", "custom_fields.json"], table: "custom_fields", blobCol: "metadata", kind: "collection" },
  { file: ["engine", "users.json"], table: "users", kind: "users" },
  { file: ["engine", "counters.json"], table: "counters", kind: "counters" },
];

/** Réglages clé/valeur (table settings). */
export const SETTINGS_FILES = [
  { file: ["engine", "assistant-settings.json"], key: "assistant-settings" },
  { file: ["engine", "saved-searches.json"], key: "saved-searches" },
  { file: ["engine", "audit-log.json"], key: "audit-log" },
];

/** Collections pg-store (fichiers JSON dispersés). */
export const PG_COLLECTIONS = [
  { file: ["ai", "analyses.json"], table: "document_ai_analyses", idKey: "id", idCol: "id", blobCol: "raw", kind: "blob", extras: [{ name: "document_id", key: "documentId" }] },
  { file: ["ai", "detected-infos.json"], table: "document_ai_suggestions", idKey: "id", idCol: "id", blobCol: "raw_payload", kind: "blob" },
  { file: ["ai", "learned-templates.json"], table: "learned_templates", idKey: "id", idCol: "id", blobCol: "raw", kind: "blob" },
  { file: ["actions", "reminders.json"], table: "reminders", idKey: "id", idCol: "id", blobCol: "raw", kind: "blob" },
  { file: ["actions", "actions.json"], table: "tasks", idKey: "id", idCol: "id", blobCol: "raw", kind: "blob" },
  { file: ["budget", "financial-items.json"], table: "budget_entries", idKey: "id", idCol: "id", blobCol: "raw", kind: "blob" },
  { file: ["project-folders.json"], table: "folders", idKey: "id", idCol: "id", blobCol: "raw", kind: "blob" },
  { file: ["mail-connector", "accounts.json"], table: "mail_accounts", idKey: "id", idCol: "id", blobCol: "metadata", kind: "blob" },
  { file: ["mail-connector", "gmail-tokens.json"], table: "mail_oauth_tokens", idKey: "accountId", idCol: "id", blobCol: "metadata", kind: "blob" },
  { file: ["email-messages.json"], table: "mails", idKey: "id", idCol: "id", blobCol: "raw", kind: "blob" },
  { file: ["email-contacts.json"], table: "email_contacts", idKey: "resourceName", idCol: "id", blobCol: "metadata", kind: "blob" },
  { file: ["hidden-senders.json"], table: "hidden_senders", idKey: "id", idCol: "id", blobCol: "metadata", kind: "blob" },
  { file: ["document-saved-signatures.json"], table: "saved_signatures", idKey: "id", idCol: "id", blobCol: "metadata", kind: "blob" },
  { file: ["document-title-overrides.json"], table: "document_title_overrides", idKey: "documentId", idCol: "document_id", blobCol: "metadata", kind: "blob" },
  { file: ["document-signatures.json"], table: "signatures", idKey: "id", idCol: "id", blobCol: "raw", kind: "scoped", scopeCol: "scope", scopeVal: "document" },
  { file: ["email-signatures.json"], table: "signatures", idKey: "id", idCol: "id", blobCol: "raw", kind: "scoped", scopeCol: "scope", scopeVal: "email" },
  { file: ["signatures", "signatures.json"], table: "signatures", idKey: "id", idCol: "id", blobCol: "raw", kind: "scoped", scopeCol: "scope", scopeVal: "writer" },
  { file: ["email-ged-links.json"], table: "mail_document_links", idKey: "id", idCol: "id", blobCol: "raw", kind: "scoped", scopeCol: "kind", scopeVal: "ged-link" },
  { file: ["mail-document-links.json"], table: "mail_document_links", idKey: "id", idCol: "id", blobCol: "raw", kind: "scoped", scopeCol: "kind", scopeVal: "attachment" },
  { file: ["document-secondary-correspondents.json"], table: "document_correspondents", kind: "doccorr", role: "secondary" },
];

/** Ouvre la base, applique PRAGMA + migrations (crée le fichier au besoin). */
export function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(
    `CREATE TABLE IF NOT EXISTS "schema_migrations" (
       "id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL UNIQUE,
       "applied_at" TEXT NOT NULL, "checksum" TEXT NOT NULL)`,
  );
  const applied = new Set(
    db.prepare(`SELECT "name" FROM "schema_migrations"`).all().map((r) => String(r.name)),
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    const checksum = createHash("sha256").update(m.sql).digest("hex").slice(0, 16);
    db.exec("BEGIN");
    try {
      db.exec(m.sql);
      db.prepare(`INSERT INTO "schema_migrations"("name","applied_at","checksum") VALUES(?,?,?)`).run(
        m.name, new Date().toISOString(), checksum,
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return db;
}

/** Lit un JSON s'il existe (sinon null). */
export function readJson(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch {
    return null;
  }
}

/** Valeur acceptée par node:sqlite (booléens → 0/1, undefined → null). */
export function bind(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "string") return v;
  return JSON.stringify(v);
}

export function fmtBytes(n) {
  if (!n) return "0 o";
  const u = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}
