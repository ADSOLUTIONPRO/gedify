#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Migration JSON → SQLite (Gedify). Lit les fichiers JSON du volume de données
// et les recopie dans gedify.sqlite, EN PRÉSERVANT ids, hashes et structure.
//
//   --dry-run   : n'écrit RIEN, affiche seulement ce qui serait migré.
//   (réel)      : sauvegarde la base existante, puis upsert (jamais de
//                 suppression). Idempotent. NE TOUCHE PAS aux fichiers JSON.
//
// Sécurité : les hashes de mots de passe sont recopiés tels quels, JAMAIS logués.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import {
  openDb, resolveDataDir, resolveDbPath, readJson, bind,
  ENGINE_COLLECTIONS, SETTINGS_FILES, PG_COLLECTIONS, fmtBytes,
} from "./gedify-sqlite-lib.mjs";

const dryRun = process.argv.includes("--dry-run");
const dataDir = resolveDataDir();
const dbPath = resolveDbPath();
const tag = dryRun ? "[migrate:dry-run]" : "[migrate]";
const abs = (parts) => path.join(dataDir, ...parts);

console.log(`${tag} DATA_DIR = ${dataDir}`);
console.log(`${tag} base     = ${dbPath}`);

// ── Plan : compter ce qui est présent dans le JSON ──────────────────────────
const plan = [];
function arrLen(v) {
  return Array.isArray(v) ? v.length : 0;
}
for (const c of ENGINE_COLLECTIONS) {
  const data = readJson(abs(c.file));
  if (data == null) continue;
  if (c.kind === "counters") plan.push({ label: `counters → ${c.table}`, count: Object.keys(data || {}).length, c, data });
  else plan.push({ label: `${c.file.join("/")} → ${c.table}`, count: arrLen(data), c, data });
}
for (const s of SETTINGS_FILES) {
  const data = readJson(abs(s.file));
  if (data == null) continue;
  plan.push({ label: `${s.file.join("/")} → settings[${s.key}]`, count: 1, setting: s, data });
}
for (const c of PG_COLLECTIONS) {
  const data = readJson(abs(c.file));
  if (data == null) continue;
  plan.push({ label: `${c.file.join("/")} → ${c.table}${c.scopeVal ? `[${c.scopeVal}]` : ""}`, count: arrLen(data), c, data });
}

if (plan.length === 0) {
  console.log(`${tag} aucun fichier JSON à migrer trouvé sous ${dataDir}.`);
  process.exit(0);
}
console.log(`${tag} collections détectées :`);
for (const p of plan) console.log(`   ${String(p.count).padStart(6)}  ${p.label}`);
const totalItems = plan.reduce((n, p) => n + p.count, 0);
console.log(`${tag} total éléments : ${totalItems}`);

if (dryRun) {
  console.log(`${tag} aucune écriture (dry-run). Relancez sans --dry-run pour migrer.`);
  process.exit(0);
}

// ── Sauvegarde de la base existante avant toute écriture ────────────────────
if (fs.existsSync(dbPath)) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  for (const suffix of ["", "-wal", "-shm"]) {
    const src = dbPath + suffix;
    if (fs.existsSync(src)) fs.copyFileSync(src, `${dbPath}.pre-migrate-${ts}.bak${suffix}`);
  }
  console.log(`${tag} sauvegarde : ${dbPath}.pre-migrate-${ts}.bak (+wal/shm si présents)`);
}

const db = openDb(dbPath);
let migrated = 0;

function upsertCollection(c, data) {
  const arr = Array.isArray(data) ? data : [];
  if (c.kind === "users") {
    const st = db.prepare(
      `INSERT INTO "users"("id","username","email","password_hash","is_superuser","is_active","metadata")
       VALUES(?,?,?,?,?,?,?)
       ON CONFLICT("id") DO UPDATE SET "username"=excluded."username","email"=excluded."email",
         "password_hash"=excluded."password_hash","is_superuser"=excluded."is_superuser",
         "is_active"=excluded."is_active","metadata"=excluded."metadata"`,
    );
    for (const item of arr) {
      const id = Number(item?.id);
      if (!Number.isFinite(id)) continue;
      st.run(id, String(item.username ?? `user-${id}`), item.email ?? null,
        item.passwordHash ?? null, item.is_superuser ? 1 : 0, item.is_active !== false ? 1 : 0,
        JSON.stringify(item));
      migrated++;
    }
    return;
  }
  // collection moteur générique (id + blobCol)
  const st = db.prepare(
    `INSERT INTO "${c.table}"("id","${c.blobCol}") VALUES(?,?) ON CONFLICT("id") DO UPDATE SET "${c.blobCol}"=excluded."${c.blobCol}"`,
  );
  for (const item of arr) {
    const id = Number(item?.id);
    if (!Number.isFinite(id)) continue;
    st.run(id, JSON.stringify(item));
    migrated++;
  }
}

function upsertCounters(data) {
  const obj = data && typeof data === "object" ? data : {};
  const st = db.prepare(
    `INSERT INTO "counters"("name","value","updated_at") VALUES(?,?,?)
     ON CONFLICT("name") DO UPDATE SET "value"=excluded."value","updated_at"=excluded."updated_at"`,
  );
  const now = new Date().toISOString();
  for (const [k, v] of Object.entries(obj)) {
    st.run(k, Number(v) || 0, now);
    migrated++;
  }
}

function upsertBlob(c, data) {
  const arr = Array.isArray(data) ? data : [];
  const extras = c.extras ?? [];
  const cols = [c.idCol, c.blobCol, ...extras.map((e) => e.name)];
  const ph = cols.map(() => "?").join(",");
  const set = [c.blobCol, ...extras.map((e) => e.name)].map((n) => `"${n}"=excluded."${n}"`).join(",");
  const st = db.prepare(
    `INSERT INTO "${c.table}"(${cols.map((n) => `"${n}"`).join(",")}) VALUES(${ph}) ON CONFLICT("${c.idCol}") DO UPDATE SET ${set}`,
  );
  for (const item of arr) {
    const id = item?.[c.idKey];
    if (id == null || id === "") continue;
    st.run(bind(id), JSON.stringify(item), ...extras.map((e) => bind(item?.[e.key])));
    migrated++;
  }
}

function upsertScoped(c, data) {
  const arr = Array.isArray(data) ? data : [];
  const st = db.prepare(
    `INSERT INTO "${c.table}"("${c.idCol}","${c.scopeCol}","${c.blobCol}") VALUES(?,?,?)
     ON CONFLICT("${c.idCol}") DO UPDATE SET "${c.scopeCol}"=excluded."${c.scopeCol}","${c.blobCol}"=excluded."${c.blobCol}"`,
  );
  for (const item of arr) {
    const id = item?.[c.idKey];
    if (id == null || id === "") continue;
    st.run(bind(id), c.scopeVal, JSON.stringify(item));
    migrated++;
  }
}

function upsertDocCorr(c, data) {
  const arr = Array.isArray(data) ? data : [];
  const st = db.prepare(
    `INSERT INTO "document_correspondents"("document_id","correspondent_id","role") VALUES(?,?,?)
     ON CONFLICT("document_id","correspondent_id") DO NOTHING`,
  );
  for (const e of arr) {
    const did = Number(e?.documentId);
    if (!Number.isFinite(did)) continue;
    for (const cid of [...new Set(e?.correspondentIds ?? [])]) {
      st.run(did, Number(cid), c.role);
      migrated++;
    }
  }
}

db.exec("BEGIN");
try {
  for (const p of plan) {
    if (p.setting) {
      db.prepare(
        `INSERT INTO "settings"("key","value") VALUES(?,?) ON CONFLICT("key") DO UPDATE SET "value"=excluded."value"`,
      ).run(p.setting.key, JSON.stringify(p.data));
      migrated++;
      continue;
    }
    const c = p.c;
    if (c.kind === "counters") upsertCounters(p.data);
    else if (c.kind === "users" || c.kind === "collection") upsertCollection(c, p.data);
    else if (c.kind === "blob") upsertBlob(c, p.data);
    else if (c.kind === "scoped") upsertScoped(c, p.data);
    else if (c.kind === "doccorr") upsertDocCorr(c, p.data);
  }
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  console.error(`${tag} ÉCHEC — restauration annulée (ROLLBACK).`, e?.message ?? e);
  db.close();
  process.exit(1);
}

db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
db.close();
console.log(`${tag} migration terminée : ${migrated} ligne(s) upsert.`);
console.log(`${tag} fichiers JSON laissés intacts. Taille base : ${fmtBytes(fs.statSync(dbPath).size)}`);
