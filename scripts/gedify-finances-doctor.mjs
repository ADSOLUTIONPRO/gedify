import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

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

// scripts/finances-doctor.ts
var PAID_LIKE = /* @__PURE__ */ new Set(["paid", "cancelled", "ignored"]);
function isOverdue(it, todayIso) {
  if (it.status === "overdue") return true;
  if (!it.dueDate) return false;
  if (it.status && PAID_LIKE.has(it.status)) return false;
  return it.dueDate.slice(0, 10) < todayIso;
}
function dupKey(it) {
  return `${it.sourceDocumentId ?? "x"}|${it.kind ?? ""}|${it.amount ?? 0}|${it.dueDate ?? ""}|${it.correspondentId ?? ""}`;
}
function main() {
  const argv = process.argv;
  const root = dataDir();
  const items = loadArray(root, "financial-items.json");
  const todayIso = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const groups = /* @__PURE__ */ new Map();
  let toReview = 0, withoutDocument = 0, withoutDueDate = 0, overdue = 0, aiCreated = 0, validated = 0;
  for (const it of items) {
    if (it.validationStatus === "needs_review" || it.status === "to_review" || it.status === "suggested") toReview += 1;
    if (it.sourceDocumentId == null) withoutDocument += 1;
    if (it.direction === "outgoing" && !it.dueDate) withoutDueDate += 1;
    if (isOverdue(it, todayIso)) overdue += 1;
    if (it.isAiDetected) aiCreated += 1;
    if (it.validationStatus === "validated" || it.status === "validated") validated += 1;
    const k = dupKey(it);
    (groups.get(k) ?? groups.set(k, []).get(k)).push(it);
  }
  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  const report = {
    dataDir: root,
    total: items.length,
    toReview,
    withoutDocument,
    withoutDueDate,
    overdue,
    aiCreated,
    validated,
    duplicateGroups: dupGroups.length
  };
  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (argv.includes("--detect-duplicates")) {
    console.log(`
\u{1F4B6} Doublons probables : ${dupGroups.length} groupe(s)`);
    for (const g of dupGroups.slice(0, 50)) {
      const f = g[0];
      console.log(`  ${g.length}\xD7 \xB7 ${f.amount ?? "?"} \u20AC \xB7 ${f.kind ?? ""} \xB7 \xE9ch. ${f.dueDate ?? "\u2014"} \xB7 doc ${f.sourceDocumentId ?? "\u2014"}`);
      console.log(`      ids: ${g.map((x) => x.id ?? "?").join(", ")}`);
    }
    console.log("\n\u2139\uFE0F  V\xE9rifiez avant toute fusion/suppression (g\xE9r\xE9e via l'UI Finances).\n");
    return;
  }
  console.log(`
\u{1F4B6} Finances \u2014 ${root}`);
  console.log(`\u{1F4CA} Lignes budget : ${report.total}
`);
  console.log("\u2500\u2500 \xC0 traiter \u2500\u2500");
  console.log(`  \xE0 contr\xF4ler         : ${toReview}`);
  console.log(`  en retard           : ${overdue}`);
  console.log(`  sans document li\xE9   : ${withoutDocument}`);
  console.log(`  sans \xE9ch\xE9ance (sort): ${withoutDueDate}`);
  console.log("\n\u2500\u2500 Provenance / \xE9tat \u2500\u2500");
  console.log(`  cr\xE9\xE9es par IA       : ${aiCreated}`);
  console.log(`  valid\xE9es            : ${validated}`);
  console.log(`  doublons possibles  : ${dupGroups.length} groupe(s)`);
  console.log("\n\u2139\uFE0F  Options : --detect-duplicates \xB7 --json   (100 % lecture seule)\n");
}
main();
