import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/diagnostic-doctor.ts
import { readdirSync as readdirSync2, statSync as statSync2, mkdirSync, writeFileSync } from "node:fs";
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

// scripts/diagnostic-doctor.ts
function dirUsage(dir) {
  let files = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync2(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path2.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else {
        try {
          bytes += statSync2(full).size;
          files += 1;
        } catch {
        }
      }
    }
  }
  return { files, bytes };
}
function listNames(dir) {
  try {
    return new Set(readdirSync2(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function fmtBytes(n) {
  const u = ["o", "Ko", "Mo", "Go", "To"];
  if (!n) return "0 o";
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}
function main() {
  const root = dataDir();
  const filesDir = process.env.FILES_DIR?.trim() || path2.join(root, "files");
  const backupsDir = process.env.BACKUPS_DIR?.trim() || path2.join(root, "backups");
  const docs = loadArray(root, "documents.json").filter((d) => !d.deleted);
  const activeIds = new Set(docs.map((d) => Number(d.id)).filter(Number.isFinite));
  const originals = /* @__PURE__ */ new Set([
    ...listNames(path2.join(filesDir, "originals")),
    ...listNames(path2.join(root, "media", "originals"))
  ]);
  let withoutOcr = 0;
  let withoutOriginal = 0;
  for (const d of docs) {
    if (!(d.content ?? "").trim()) withoutOcr += 1;
    if (d.storedFilename && !originals.has(d.storedFilename)) withoutOriginal += 1;
  }
  let orphanOriginals = 0;
  for (const n of originals) {
    const m = n.match(/^(\d+)/);
    if (m && !activeIds.has(Number(m[1]))) orphanOriginals += 1;
  }
  const jobs = loadArray(root, "pipeline-jobs.json");
  const jobBy = (s) => jobs.filter((j) => j.status === s).length;
  const storage = {
    originals: dirUsage(path2.join(filesDir, "originals")),
    thumbnails: dirUsage(path2.join(filesDir, "thumbnails")),
    previews: dirUsage(path2.join(filesDir, "previews")),
    pages: dirUsage(path2.join(filesDir, "pages")),
    signed: dirUsage(path2.join(filesDir, "signed")),
    backups: dirUsage(backupsDir)
  };
  const totalBytes = Object.values(storage).reduce((a, u) => a + u.bytes, 0);
  const warnings = [];
  const errors = [];
  if (withoutOriginal) errors.push(`${withoutOriginal} document(s) sans fichier original`);
  if (jobBy("failed")) warnings.push(`${jobBy("failed")} job(s) en erreur`);
  if (withoutOcr) warnings.push(`${withoutOcr} document(s) sans OCR`);
  if (orphanOriginals) warnings.push(`${orphanOriginals} fichier(s) original(aux) orphelin(s)`);
  if (!storage.backups.files) warnings.push("aucune sauvegarde pr\xE9sente");
  const report = {
    status: errors.length ? "error" : warnings.length ? "warning" : "ok",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    dataDir: root,
    documents: {
      total: docs.length,
      withoutOcr,
      withoutOriginal,
      orphanOriginals
    },
    storage: { ...storage, totalBytes },
    jobs: {
      pending: jobBy("pending"),
      processing: jobBy("processing"),
      failed: jobBy("failed"),
      done: jobBy("done"),
      total: jobs.length
    },
    warnings,
    errors
  };
  if (process.argv.includes("--save")) {
    const dir = path2.join(backupsDir, "reports");
    mkdirSync(dir, { recursive: true });
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const out = path2.join(dir, `diagnostic-${stamp}.json`);
    writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
    console.log(`\u{1F4DD} Rapport \xE9crit : ${out}`);
  }
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`
\u{1FA7A} Diagnostic Gedify \u2014 ${root}`);
  console.log(`Statut global : ${report.status === "ok" ? "\u2705 ok" : report.status === "warning" ? "\u26A0\uFE0F warning" : "\u274C error"}`);
  console.log("\n\u2500\u2500 Documents \u2500\u2500");
  console.log(`  total            : ${report.documents.total}`);
  console.log(`  sans OCR         : ${report.documents.withoutOcr}`);
  console.log(`  sans original    : ${report.documents.withoutOriginal}`);
  console.log(`  originaux orphelins: ${report.documents.orphanOriginals}`);
  console.log("\n\u2500\u2500 Stockage \u2500\u2500");
  console.log(`  originaux  : ${storage.originals.files} \xB7 ${fmtBytes(storage.originals.bytes)}`);
  console.log(`  miniatures : ${storage.thumbnails.files} \xB7 ${fmtBytes(storage.thumbnails.bytes)}`);
  console.log(`  aper\xE7us    : ${storage.previews.files} \xB7 ${fmtBytes(storage.previews.bytes)}`);
  console.log(`  pages      : ${storage.pages.files} \xB7 ${fmtBytes(storage.pages.bytes)}`);
  console.log(`  sign\xE9s     : ${storage.signed.files} \xB7 ${fmtBytes(storage.signed.bytes)}`);
  console.log(`  sauvegardes: ${storage.backups.files} \xB7 ${fmtBytes(storage.backups.bytes)}`);
  console.log(`  total      : ${fmtBytes(totalBytes)}`);
  console.log("\n\u2500\u2500 Jobs \u2500\u2500");
  console.log(`  en attente : ${report.jobs.pending}  \xB7  en cours : ${report.jobs.processing}  \xB7  \xE9chou\xE9s : ${report.jobs.failed}`);
  if (warnings.length) {
    console.log("\n\u26A0\uFE0F  Avertissements :");
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (errors.length) {
    console.log("\n\u274C Erreurs :");
    for (const e of errors) console.log(`  - ${e}`);
  }
  console.log("\n\u2139\uFE0F  Options : --json \xB7 --save   (lecture seule ; --save cr\xE9e un rapport horodat\xE9)\n");
}
main();
