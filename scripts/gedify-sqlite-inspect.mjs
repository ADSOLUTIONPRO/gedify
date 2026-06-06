#!/usr/bin/env node
// Inspecte la base SQLite : PRAGMA, migrations, nombre de lignes par table,
// taille du fichier (+ WAL). LECTURE SEULE, ne révèle aucun secret.
import fs from "node:fs";
import { openDb, resolveDbPath, ALL_TABLES, fmtBytes } from "./gedify-sqlite-lib.mjs";

const dbPath = resolveDbPath();
if (!fs.existsSync(dbPath)) {
  console.log(`[gedify:sqlite:inspect] aucune base à : ${dbPath} (lancez gedify:sqlite:init)`);
  process.exit(0);
}

const db = openDb(dbPath);
const jm = db.prepare("PRAGMA journal_mode").get();
const fk = db.prepare("PRAGMA foreign_keys").get();
const bt = db.prepare("PRAGMA busy_timeout").get();
const migs = db.prepare(`SELECT "name","applied_at" FROM "schema_migrations" ORDER BY "id"`).all();

console.log(`[gedify:sqlite:inspect] base : ${dbPath}`);
console.log(`  journal_mode=${jm?.journal_mode}  foreign_keys=${fk?.foreign_keys}  busy_timeout=${bt?.timeout ?? bt?.busy_timeout ?? "?"}`);
console.log(`  taille=${fmtBytes(fs.statSync(dbPath).size)}` + (fs.existsSync(dbPath + "-wal") ? `  wal=${fmtBytes(fs.statSync(dbPath + "-wal").size)}` : ""));
console.log(`  migrations=${migs.map((m) => m.name).join(", ") || "(aucune)"}`);
console.log("  lignes par table :");
let total = 0;
for (const t of ALL_TABLES) {
  try {
    const n = Number(db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n);
    total += n;
    if (n > 0) console.log(`    ${t.padEnd(26)} ${n}`);
  } catch {
    console.log(`    ${t.padEnd(26)} (absente)`);
  }
}
db.close();
console.log(`  total lignes (toutes tables) : ${total}`);
