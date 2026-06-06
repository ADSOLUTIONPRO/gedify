import "server-only";

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Backend SQLite RÉEL de Gedify (cible Synology Docker, 1 conteneur / 1 volume).

   Ouvre un VRAI fichier `gedify.sqlite` dans le volume de données, applique les
   PRAGMA recommandés (WAL, foreign_keys, busy_timeout, synchronous) puis crée
   les tables + le journal de migrations idempotent (schema_migrations).

   • Le module natif `node:sqlite` est CHARGÉ PARESSEUSEMENT, et UNIQUEMENT en
     mode `GEDIFY_STORAGE_MODE=sqlite`. Les apps bureau (Electron, Node 20 — sans
     `node:sqlite`) tournent en mode JSON et n'importent donc JAMAIS ce module.
   • On charge via `process.getBuiltinModule("node:sqlite")` pour éviter que le
     bundler (Next/webpack) tente de résoudre/empaqueter un module intégré.
   • Aucune donnée binaire (PDF, miniatures…) n'est stockée en base : seuls les
     métadonnées/blobs JSON applicatifs y vivent. Les fichiers restent sur disque.
   ──────────────────────────────────────────────────────────────────────── */

export interface SqliteStatement {
  all(...params: unknown[]): Array<Record<string, unknown>>;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}
export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

type SqliteModule = { DatabaseSync: new (path: string, opts?: unknown) => SqliteDatabase };

/** Racine du volume de données (DATA_DIR ?? APP_DATA_DIR ?? <cwd>/.data). */
export function resolveGedifyDataDir(): string {
  return getDataDir();
}

/**
 * Chemin du fichier SQLite. Priorité :
 *   1. DATABASE_URL=file:/chemin/gedify.sqlite  → le chemin après `file:`
 *   2. DATABASE_URL=/chemin/gedify.sqlite        → chemin nu (sans schéma ://)
 *   3. <DATA_DIR>/gedify.sqlite                   → défaut
 * (Une URL postgres:// est ignorée ici : ce module n'est utilisé qu'en mode sqlite.)
 */
export function resolveGedifyDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (raw) {
    if (/^file:/i.test(raw)) {
      const p = raw.replace(/^file:(\/\/)?/i, "");
      if (p) return path.isAbsolute(p) ? p : path.join(resolveGedifyDataDir(), p);
    } else if (!raw.includes("://")) {
      return path.isAbsolute(raw) ? raw : path.join(resolveGedifyDataDir(), raw);
    }
  }
  return path.join(resolveGedifyDataDir(), "gedify.sqlite");
}

function loadSqliteModule(): SqliteModule {
  // `process.getBuiltinModule` (Node ≥ 22.3) charge un module intégré au RUNTIME,
  // sans que le bundler (Next/webpack) tente de résoudre/empaqueter « node:sqlite ».
  const proc = process as unknown as { getBuiltinModule?: (m: string) => unknown };
  const mod =
    typeof proc.getBuiltinModule === "function"
      ? (proc.getBuiltinModule("node:sqlite") as SqliteModule | undefined)
      : undefined;
  if (!mod?.DatabaseSync) {
    throw new Error(
      "node:sqlite indisponible (Node ≥ 22.5 requis ; le conteneur fixe NODE_OPTIONS=--experimental-sqlite).",
    );
  }
  return mod;
}

/* ── Migrations idempotentes ────────────────────────────────────────────────
   Chaque migration porte un `name` unique. À l'ouverture, on applique celles
   non encore présentes dans `schema_migrations`. Toutes utilisent
   `CREATE TABLE IF NOT EXISTS` → ré-exécuter est sans effet. On n'écrase JAMAIS
   une base existante ni ses données. Le modèle Gedify est « blob JSON » : chaque
   table porte une colonne intégrale (`raw`/`metadata`/`raw_payload`) reprenant
   l'objet d'origine, + d'éventuelles colonnes requêtables. */
type Migration = { name: string; sql: string };

const MIGRATIONS: Migration[] = [
  {
    name: "001_initial_schema",
    sql: `
      /* Cœur moteur (collections documentaires) — colonne raw = objet intégral */
      CREATE TABLE IF NOT EXISTS "documents"        ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "tags"             ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "document_types"   ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "correspondents"   ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "custom_fields"    ("id" PRIMARY KEY, "metadata" TEXT);

      /* Comptes utilisateurs : colonnes explicites (username NOT NULL, hash hors blob) + metadata */
      CREATE TABLE IF NOT EXISTS "users" (
        "id" PRIMARY KEY,
        "username" TEXT NOT NULL,
        "email" TEXT,
        "password_hash" TEXT,
        "is_superuser" INTEGER DEFAULT 0,
        "is_active" INTEGER DEFAULT 1,
        "metadata" TEXT
      );

      /* Séquences d'ID atomiques + réglages clé/valeur */
      CREATE TABLE IF NOT EXISTS "counters"  ("name" TEXT PRIMARY KEY, "value" INTEGER NOT NULL DEFAULT 0, "updated_at" TEXT);
      CREATE TABLE IF NOT EXISTS "settings"  ("key" TEXT PRIMARY KEY, "value" TEXT);

      /* Jointure correspondants secondaires (clé composite, pas de blob) */
      CREATE TABLE IF NOT EXISTS "document_correspondents" (
        "document_id" INTEGER NOT NULL,
        "correspondent_id" INTEGER NOT NULL,
        "role" TEXT NOT NULL,
        PRIMARY KEY ("document_id", "correspondent_id")
      );

      /* IA : analyses (document_id requêtable) + suggestions détectées */
      CREATE TABLE IF NOT EXISTS "document_ai_analyses"    ("id" PRIMARY KEY, "raw" TEXT, "document_id" INTEGER);
      CREATE TABLE IF NOT EXISTS "document_ai_suggestions" ("id" PRIMARY KEY, "raw_payload" TEXT);
      CREATE TABLE IF NOT EXISTS "learned_templates"       ("id" PRIMARY KEY, "raw" TEXT);

      /* Surcharges de titre (clé = document_id, blob = metadata) */
      CREATE TABLE IF NOT EXISTS "document_title_overrides" ("document_id" PRIMARY KEY, "metadata" TEXT);

      /* Budget, rappels, tâches */
      CREATE TABLE IF NOT EXISTS "budget_entries" ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "reminders"      ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "tasks"          ("id" PRIMARY KEY, "raw" TEXT);

      /* Projets/dossiers (store pg-store « folders ») */
      CREATE TABLE IF NOT EXISTS "folders" ("id" PRIMARY KEY, "raw" TEXT);

      /* Signatures (table partagée par portée : document / email / writer) */
      CREATE TABLE IF NOT EXISTS "signatures" ("id" PRIMARY KEY, "scope" TEXT, "raw" TEXT);

      /* Messagerie : comptes, tokens OAuth, mails, contacts, expéditeurs masqués */
      CREATE TABLE IF NOT EXISTS "mail_accounts"     ("id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "mail_oauth_tokens" ("id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "mails"             ("id" PRIMARY KEY, "raw" TEXT);
      CREATE TABLE IF NOT EXISTS "email_contacts"    ("id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "hidden_senders"    ("id" PRIMARY KEY, "metadata" TEXT);
      CREATE TABLE IF NOT EXISTS "saved_signatures"  ("id" PRIMARY KEY, "metadata" TEXT);

      /* Liens mail ↔ document (table partagée par genre : ged-link / attachment) */
      CREATE TABLE IF NOT EXISTS "mail_document_links" ("id" PRIMARY KEY, "kind" TEXT, "raw" TEXT);

      /* Index requêtables (perf) */
      CREATE INDEX IF NOT EXISTS "idx_ai_analyses_doc"  ON "document_ai_analyses" ("document_id");
      CREATE INDEX IF NOT EXISTS "idx_signatures_scope" ON "signatures" ("scope");
      CREATE INDEX IF NOT EXISTS "idx_links_kind"       ON "mail_document_links" ("kind");
      CREATE INDEX IF NOT EXISTS "idx_doc_corr_role"    ON "document_correspondents" ("role");
    `,
  },
];

let db: SqliteDatabase | null = null;
let initError: Error | null = null;

function applyMigrations(handle: SqliteDatabase): void {
  handle.exec(
    `CREATE TABLE IF NOT EXISTS "schema_migrations" (
       "id" INTEGER PRIMARY KEY AUTOINCREMENT,
       "name" TEXT NOT NULL UNIQUE,
       "applied_at" TEXT NOT NULL,
       "checksum" TEXT NOT NULL
     )`,
  );
  const applied = new Set(
    handle.prepare(`SELECT "name" FROM "schema_migrations"`).all().map((r) => String(r.name)),
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    const checksum = createHash("sha256").update(m.sql).digest("hex").slice(0, 16);
    handle.exec("BEGIN");
    try {
      handle.exec(m.sql);
      handle
        .prepare(`INSERT INTO "schema_migrations"("name","applied_at","checksum") VALUES(?,?,?)`)
        .run(m.name, new Date().toISOString(), checksum);
      handle.exec("COMMIT");
    } catch (e) {
      handle.exec("ROLLBACK");
      throw e;
    }
  }
}

/**
 * Active le mode WAL et VÉRIFIE par une écriture réelle qu'il fonctionne sur ce
 * volume. Certains montages (bind mounts Synology, partages réseau) ne gèrent pas
 * la mémoire partagée WAL et lèvent « disk I/O error » dès la 1ʳᵉ écriture : on
 * détecte ce cas ici pour pouvoir retomber sur le mode DELETE (compatible partout).
 */
function tryEnableWal(handle: SqliteDatabase): boolean {
  try {
    handle.exec("PRAGMA journal_mode = WAL;");
    // Sonde : une écriture réelle déclenche la création des fichiers -wal/-shm,
    // donc l'éventuelle « disk I/O error » d'un volume incompatible WAL.
    handle.exec('CREATE TABLE IF NOT EXISTS "__wal_probe" ("x" INTEGER); DROP TABLE "__wal_probe";');
    return true;
  } catch {
    return false;
  }
}

/** Ouvre (paresseusement) la base SQLite, applique PRAGMA + migrations. Idempotent. */
export function getSqlite(): SqliteDatabase {
  if (db) return db;
  if (initError) throw initError;
  try {
    const dbPath = resolveGedifyDatabaseUrl();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const { DatabaseSync } = loadSqliteModule();
    const handle = new DatabaseSync(dbPath);
    // PRAGMA : intégrité référentielle, attente sur verrou, durabilité raisonnable.
    handle.exec("PRAGMA foreign_keys = ON;");
    handle.exec("PRAGMA busy_timeout = 5000;");
    handle.exec("PRAGMA synchronous = NORMAL;");
    // WAL (meilleures lectures concurrentes) SI le volume le supporte ; sinon repli
    // DELETE — évite un crash « disk I/O error » sur certains volumes Synology
    // (bind mount), tout en gardant la base 100 % fonctionnelle.
    if (!tryEnableWal(handle)) {
      handle.exec("PRAGMA journal_mode = DELETE;");
    }
    applyMigrations(handle);
    db = handle;
    return db;
  } catch (e) {
    initError = e instanceof Error ? e : new Error(String(e));
    // Trace explicite dans `docker logs gedify` (sinon masqué derrière un 500).
    console.error(`[sqlite] ouverture impossible (${resolveGedifyDatabaseUrl()}) :`, initError.message);
    throw initError;
  }
}

/** Force un checkpoint WAL (TRUNCATE) — à appeler avant une sauvegarde à froid. */
export function checkpointSqlite(): void {
  try {
    getSqlite().prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
  } catch {
    /* best-effort */
  }
}

/** Ferme la base (utilisé par les scripts CLI ; l'app garde le handle ouvert). */
export function closeSqlite(): void {
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    db = null;
  }
}

export type SqliteHealth = {
  ok: boolean;
  error: string | null;
  path: string;
  exists: boolean;
  walActive: boolean;
  foreignKeys: boolean;
  sizeBytes: number;
  walSizeBytes: number;
  appliedMigrations: number;
  counts: Record<string, number>;
};

function fileSize(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

/** Snapshot lecture-seule pour la Santé GED (jamais de secret). */
export function sqliteHealth(): SqliteHealth {
  const dbPath = resolveGedifyDatabaseUrl();
  const exists = fs.existsSync(dbPath);
  const counts: Record<string, number> = {};
  try {
    const handle = getSqlite();
    const jm = handle.prepare("PRAGMA journal_mode").get() as { journal_mode?: string } | undefined;
    const fk = handle.prepare("PRAGMA foreign_keys").get() as { foreign_keys?: number } | undefined;
    const mig = handle.prepare(`SELECT COUNT(*) AS n FROM "schema_migrations"`).get() as { n?: number };
    for (const t of ["documents", "tags", "correspondents", "budget_entries"]) {
      try {
        const row = handle.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get() as { n?: number };
        counts[t] = Number(row?.n ?? 0);
      } catch {
        counts[t] = 0;
      }
    }
    return {
      ok: true,
      error: null,
      path: dbPath,
      exists: true,
      walActive: String(jm?.journal_mode ?? "").toLowerCase() === "wal",
      foreignKeys: Number(fk?.foreign_keys ?? 0) === 1,
      sizeBytes: fileSize(dbPath),
      walSizeBytes: fileSize(`${dbPath}-wal`),
      appliedMigrations: Number(mig?.n ?? 0),
      counts,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      path: dbPath,
      exists,
      walActive: false,
      foreignKeys: false,
      sizeBytes: fileSize(dbPath),
      walSizeBytes: fileSize(`${dbPath}-wal`),
      appliedMigrations: 0,
      counts,
    };
  }
}
