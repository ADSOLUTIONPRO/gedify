#!/usr/bin/env node
/*
 * Rassemble le CLI Prisma + TOUTE sa closure de dépendances (hors `@prisma/*`,
 * déjà fourni par `COPY @prisma`) dans un dossier « bundle », pour rendre la
 * commande `prisma` exécutable dans l'image RUNTIME SANS installation réseau.
 *
 * Pourquoi : le CLI Prisma 7 charge au démarrage des paquets situés hors
 * `@prisma/*` (mysql2, postgres, @electric-sql/pglite, @hono/node-server, c12,
 * @prisma/studio-core → chart.js/@radix-ui…). Ces paquets ne sont PAS dans la
 * sortie `standalone` de Next. On réutilise donc les paquets DÉJÀ installés et
 * validés par l'étape builder (où `prisma generate` a réussi, moteur Alpine
 * inclus) → fiable et hors-ligne.
 *
 * Usage : node scripts/collect-prisma-runtime.mjs <dossier_node_modules_cible>
 */
import fs from "node:fs";
import path from "node:path";

const NODE_MODULES = "node_modules";
const dest = process.argv[2];
if (!dest) {
  console.error("usage: node scripts/collect-prisma-runtime.mjs <destNodeModulesDir>");
  process.exit(1);
}

function readPkg(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(NODE_MODULES, name, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

// Closure transitive (dependencies + optionalDependencies) à partir de `prisma`.
const seen = new Set();
function walk(name) {
  if (seen.has(name)) return;
  const p = readPkg(name);
  if (!p) return; // non hissé au top-level (résolu via un nested node_modules d'un parent déjà copié)
  seen.add(name);
  const deps = { ...p.dependencies, ...p.optionalDependencies };
  for (const d of Object.keys(deps)) walk(d);
}
walk("prisma");

// On copie `prisma` + la closure NON-`@prisma/*` (les `@prisma/*` viennent du
// `COPY @prisma` de l'image runtime).
const toCopy = [...seen].filter((n) => n === "prisma" || !n.startsWith("@prisma/"));

let copied = 0;
const missing = [];
for (const name of toCopy) {
  const src = path.join(NODE_MODULES, name);
  if (!fs.existsSync(src)) {
    missing.push(name);
    continue;
  }
  const target = path.join(dest, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(src, target, { recursive: true, dereference: false });
  copied++;
}

console.log(`[collect-prisma] ${copied} paquets copiés → ${dest} (closure de prisma, hors @prisma/*).`);
if (missing.length) {
  console.warn(`[collect-prisma] ${missing.length} introuvables (probablement nested) : ${missing.join(", ")}`);
}
