#!/usr/bin/env node
// Crée (si absent) le fichier gedify.sqlite + toutes les tables + applique les
// migrations. Idempotent : n'écrase JAMAIS une base existante. Affiche un résumé.
import fs from "node:fs";
import { openDb, resolveDbPath, ALL_TABLES, fmtBytes } from "./gedify-sqlite-lib.mjs";

const dbPath = resolveDbPath();
const existedBefore = fs.existsSync(dbPath);
console.log(`[gedify:sqlite:init] base : ${dbPath}`);
console.log(`[gedify:sqlite:init] ${existedBefore ? "déjà présente → vérification/migrations" : "création"}`);

const db = openDb(dbPath);
const migs = db.prepare(`SELECT "name","applied_at" FROM "schema_migrations" ORDER BY "id"`).all();
const present = new Set(
  db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => String(r.name)),
);
const missing = ALL_TABLES.filter((t) => !present.has(t));
db.close();

console.log(`[gedify:sqlite:init] migrations appliquées : ${migs.map((m) => m.name).join(", ") || "(aucune)"}`);
console.log(`[gedify:sqlite:init] tables présentes : ${ALL_TABLES.length - missing.length}/${ALL_TABLES.length}`);
if (missing.length) console.log(`[gedify:sqlite:init] ⚠️ manquantes : ${missing.join(", ")}`);
console.log(`[gedify:sqlite:init] taille fichier : ${fmtBytes(fs.statSync(dbPath).size)}`);
console.log("[gedify:sqlite:init] OK");
