#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Diagnostic AUTH + persistance GEDify (Synology / SQLite) — LECTURE SEULE.
//   docker exec <gedify> npm run gedify:auth:doctor
//   (ou : node --experimental-sqlite scripts/gedify-auth-doctor.mjs)
//
// Ne modifie/supprime RIEN. N'affiche AUCUNE valeur secrète (présence seulement).
// Reproduit la résolution de chemin de src/lib/db/sqlite/client.ts.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";

function dataDir() {
  const v = process.env.DATA_DIR || process.env.APP_DATA_DIR;
  return (v && v.trim()) || path.join(process.cwd(), ".data");
}
function storageMode() {
  const m = (process.env.GEDIFY_STORAGE_MODE || "").trim().toLowerCase();
  return m === "postgres" || m === "sqlite" ? m : "json";
}
function dbPath() {
  const raw = (process.env.DATABASE_URL || "").trim();
  if (raw) {
    if (/^file:/i.test(raw)) {
      const p = raw.replace(/^file:(\/\/)?/i, "");
      if (p) return path.isAbsolute(p) ? p : path.join(dataDir(), p);
    } else if (!raw.includes("://")) {
      return path.isAbsolute(raw) ? raw : path.join(dataDir(), raw);
    }
  }
  return path.join(dataDir(), "gedify.sqlite");
}
function size(p) { try { return fs.statSync(p).size; } catch { return 0; } }
function writable(p) { try { fs.accessSync(p, fs.constants.W_OK); return true; } catch { return false; } }

const LEGACY = ["gedify.db", "database.sqlite", "dev.db", "data.sqlite", "prisma/dev.db"];

const mode = storageMode();
const dir = dataDir();
const file = dbPath();
const exists = fs.existsSync(file);

let usersCount = 0;
let appliedMigrations = 0;
let dbError = null;

if (mode === "sqlite" && exists) {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(file);
    try { usersCount = Number(db.prepare('SELECT COUNT(*) AS n FROM "users"').get()?.n ?? 0); } catch { /* table absente */ }
    try { appliedMigrations = Number(db.prepare('SELECT COUNT(*) AS n FROM "schema_migrations"').get()?.n ?? 0); } catch { /* idem */ }
    db.close();
  } catch (e) {
    dbError = e && e.message ? e.message : String(e);
  }
} else if (mode === "json") {
  try {
    const arr = JSON.parse(fs.readFileSync(path.join(dir, "engine", "users.json"), "utf8"));
    usersCount = Array.isArray(arr) ? arr.length : 0;
  } catch { /* pas de users.json */ }
}

const secretsFile = path.join(dir, "secrets.env");
const secretsFileExists = fs.existsSync(secretsFile);
function secretPresent(name) {
  if (process.env[name] && process.env[name].trim()) return true;
  try {
    return new RegExp(`^${name}=.+`, "m").test(fs.readFileSync(secretsFile, "utf8"));
  } catch {
    return false;
  }
}

const legacyDbFiles = LEGACY
  .map((n) => path.join(dir, n))
  .filter((p) => fs.existsSync(p) && p !== file);

const out = {
  runtime: `node ${process.version}`,
  storageMode: mode,
  dataDir: dir,
  dataDirWritable: writable(dir),
  databasePath: mode === "sqlite" ? file : null,
  databaseExists: mode === "sqlite" ? exists : null,
  databaseWritable: mode === "sqlite" ? (exists ? writable(file) : writable(dir)) : null,
  databaseSize: mode === "sqlite" ? size(file) : null,
  walSize: mode === "sqlite" ? size(`${file}-wal`) : null,
  appliedMigrations,
  usersCount,
  legacyDbFiles,
  secretsFileExists,
  authSecretPresent: secretPresent("AUTH_SECRET"),
  sessionSecretPresent: secretPresent("SESSION_SECRET"),
  dbError,
};

console.log(JSON.stringify(out, null, 2));

if (usersCount === 0 && legacyDbFiles.length > 0) {
  console.error("\n⛔ ANOMALIE : 0 utilisateur mais base SQLite héritée détectée — vérifiez le montage du volume. AUCUNE donnée supprimée.");
  process.exitCode = 2;
}
