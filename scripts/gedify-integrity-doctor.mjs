import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/integrity-doctor.ts
import { readdirSync as readdirSync2 } from "node:fs";
import path2 from "node:path";

// scripts/_shared.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
function dataDir() {
  return process.env.JSON_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || process.env.APP_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}
var SKIP_DIRS = /* @__PURE__ */ new Set(["backups", "node_modules", ".next", ".git", "media", "tessdata"]);
function findJsonFiles(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
      } else if (name.endsWith(".json")) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}
function findByBasename(root, basename) {
  return findJsonFiles(root).find((f) => path.basename(f) === basename) ?? null;
}
function loadJson(file) {
  try {
    return { ok: true, data: JSON.parse(readFileSync(file, "utf8")) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
function loadArray(root, basename) {
  const file = findByBasename(root, basename);
  if (!file) return [];
  const res = loadJson(file);
  return res.ok && Array.isArray(res.data) ? res.data : [];
}

// scripts/integrity-doctor.ts
function listFiles(dir) {
  try {
    return readdirSync2(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}
function main() {
  const argv = process.argv;
  const root = dataDir();
  const docs = loadArray(root, "documents.json").filter((d) => !d.deleted);
  const activeIds = new Set(docs.map((d) => Number(d.id)).filter(Number.isFinite));
  const originalNames = /* @__PURE__ */ new Set([
    ...listFiles(path2.join(root, "files", "originals")),
    ...listFiles(path2.join(root, "media", "originals"))
  ]);
  const docsWithoutOriginal = [];
  let docsWithoutOcr = 0;
  for (const d of docs) {
    if (d.storedFilename && !originalNames.has(d.storedFilename)) docsWithoutOriginal.push(Number(d.id));
    if (!(d.content ?? "").trim()) docsWithoutOcr += 1;
  }
  const orphanOriginals = [];
  for (const name of originalNames) {
    const m = name.match(/^(\d+)/);
    if (m && !activeIds.has(Number(m[1]))) orphanOriginals.push(name);
  }
  const financial = loadArray(root, "financial-items.json");
  const brokenBudgetLinks = financial.filter(
    (it) => it.sourceDocumentId != null && !activeIds.has(Number(it.sourceDocumentId))
  ).length;
  const mailLinks = loadArray(root, "mail-document-links.json");
  const brokenMailLinks = mailLinks.filter(
    (l) => l.paperlessDocumentId != null && !activeIds.has(Number(l.paperlessDocumentId))
  ).length;
  const report = {
    status: docsWithoutOriginal.length || brokenBudgetLinks || brokenMailLinks ? "warning" : "ok",
    dataDir: root,
    documents: docs.length,
    originalsOnDisk: originalNames.size,
    docsWithoutOriginal: docsWithoutOriginal.length,
    orphanOriginals: orphanOriginals.length,
    docsWithoutOcr,
    brokenBudgetLinks,
    brokenMailLinks,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (argv.includes("--missing")) {
    console.log(`
\u{1F4C4} Documents sans fichier original : ${docsWithoutOriginal.length}`);
    for (const id of docsWithoutOriginal.slice(0, 100)) console.log(`  #${id}`);
    if (docsWithoutOriginal.length > 100) console.log(`  \u2026 (+${docsWithoutOriginal.length - 100})`);
    console.log("\n\u2139\uFE0F  Restaurez depuis une sauvegarde \u2014 ne supprimez PAS ces documents.\n");
    return;
  }
  if (argv.includes("--orphans")) {
    console.log(`
\u{1F5C2}\uFE0F  Fichiers originaux orphelins : ${orphanOriginals.length}`);
    for (const n of orphanOriginals.slice(0, 100)) console.log(`  ${n}`);
    if (orphanOriginals.length > 100) console.log(`  \u2026 (+${orphanOriginals.length - 100})`);
    console.log("\n\u2139\uFE0F  Aucun document actif ne les r\xE9f\xE9rence. V\xE9rifiez avant tout nettoyage manuel.\n");
    return;
  }
  console.log(`
\u{1FA7A} Int\xE9grit\xE9 Gedify \u2014 ${root}`);
  console.log(`\u{1F4C4} Documents actifs        : ${report.documents}`);
  console.log(`\u{1F5C2}\uFE0F  Originaux sur disque     : ${report.originalsOnDisk}`);
  console.log("\n\u2500\u2500 Anomalies \u2500\u2500");
  console.log(`  documents sans original  : ${report.docsWithoutOriginal}${report.docsWithoutOriginal ? "  \u26A0\uFE0F" : ""}`);
  console.log(`  originaux orphelins      : ${report.orphanOriginals}`);
  console.log(`  documents sans OCR       : ${report.docsWithoutOcr}`);
  console.log(`  liens budget cass\xE9s      : ${report.brokenBudgetLinks}${report.brokenBudgetLinks ? "  \u26A0\uFE0F" : ""}`);
  console.log(`  liens mail cass\xE9s        : ${report.brokenMailLinks}${report.brokenMailLinks ? "  \u26A0\uFE0F" : ""}`);
  console.log(`
Statut global : ${report.status === "ok" ? "\u2705 ok" : "\u26A0\uFE0F warning"}`);
  console.log("\n\u2139\uFE0F  Options : --missing \xB7 --orphans \xB7 --json   (100 % lecture seule)\n");
}
main();
