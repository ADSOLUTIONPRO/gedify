import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/classification-doctor.ts
import { mkdirSync, readFileSync as readFileSync2, renameSync, writeFileSync } from "node:fs";
import path2 from "node:path";
import { randomUUID } from "node:crypto";

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

// scripts/classification-doctor.ts
function norm(s) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
function jobsFile(root) {
  return path2.join(root, "jobs", "pipeline-jobs.json");
}
function readJobs(root) {
  try {
    const p = JSON.parse(readFileSync2(jobsFile(root), "utf8"));
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}
function writeJobs(root, jobs) {
  const f = jobsFile(root);
  mkdirSync(path2.dirname(f), { recursive: true });
  const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(jobs, null, 2), "utf8");
  renameSync(tmp, f);
}
function enqueue(jobs, type, documentId, priority) {
  if (jobs.some((j) => j.type === type && j.documentId === documentId && (j.status === "pending" || j.status === "processing"))) return false;
  jobs.push({ id: randomUUID(), type, documentId, payload: null, status: "pending", priority, attempts: 0, maxAttempts: 3, lastError: null, createdAt: (/* @__PURE__ */ new Date()).toISOString(), startedAt: null, finishedAt: null });
  return true;
}
function main() {
  const argv = process.argv;
  const root = dataDir();
  const docs = loadArray(root, "documents.json").filter((d) => !d.deleted);
  const tags = loadArray(root, "tags.json");
  const types = loadArray(root, "document_types.json");
  const correspondents = loadArray(root, "correspondents.json");
  const folders = loadArray(root, "project-folders.json");
  const inFolder = /* @__PURE__ */ new Set();
  for (const f of folders) for (const id of f.linkedDocumentIds ?? []) inFolder.add(Number(id));
  const usedTags = /* @__PURE__ */ new Set();
  const usedTypes = /* @__PURE__ */ new Set();
  let wTag = 0, wType = 0, wCorr = 0, wFolder = 0, review = 0;
  for (const d of docs) {
    if (!d.tags?.length) wTag += 1;
    else for (const t of d.tags) usedTags.add(t);
    if (d.document_type == null) wType += 1;
    else usedTypes.add(d.document_type);
    if (d.correspondent == null) wCorr += 1;
    if (typeof d.id === "number" && !inFolder.has(d.id)) wFolder += 1;
    if (d.needs_review_reason) review += 1;
  }
  const unusedTags = tags.filter((t) => typeof t.id === "number" && !usedTags.has(t.id));
  const unusedTypes = types.filter((t) => typeof t.id === "number" && !usedTypes.has(t.id));
  const parentIds = new Set(folders.map((f) => f.parentId).filter(Boolean));
  const emptyFolders = folders.filter((f) => (f.linkedDocumentIds?.length ?? 0) === 0 && f.id && !parentIds.has(f.id));
  const byNorm = /* @__PURE__ */ new Map();
  for (const c of correspondents) {
    const n = norm(c.name ?? "");
    if (n.length < 2) continue;
    (byNorm.get(n) ?? byNorm.set(n, []).get(n)).push(c);
  }
  const dupCorr = [...byNorm.values()].filter((a) => a.length > 1);
  if (argv.includes("--tags")) {
    console.log(`
\u{1F3F7}\uFE0F  Tags inutilis\xE9s : ${unusedTags.length}`);
    for (const t of unusedTags.slice(0, 50)) console.log(`  #${t.id} ${t.name ?? ""}`);
    console.log("\n\u2139\uFE0F  Supprimez-les depuis /tags (g\xE8re JSON et PostgreSQL).\n");
    return;
  }
  if (argv.includes("--correspondents")) {
    console.log(`
\u{1F465} Correspondants doublons probables : ${dupCorr.length} groupe(s)`);
    for (const g of dupCorr.slice(0, 50)) console.log(`  ${g.map((c) => `#${c.id} ${c.name ?? ""}`).join("  \xB7  ")}`);
    console.log("\n\u2139\uFE0F  Fusionnez-les depuis /correspondants.\n");
    return;
  }
  if (argv.includes("--apply-safe")) {
    const dry = argv.includes("--dry-run");
    const targets = docs.filter((d) => typeof d.id === "number" && (d.content ?? "").trim() && (d.document_type == null || d.correspondent == null));
    if (dry) {
      console.log(`
\u{1F9EA} Dry-run : ${targets.length} document(s) OCRis\xE9s sans type/correspondant seraient analys\xE9s par l'IA.
`);
      return;
    }
    const jobs = readJobs(root);
    let queued = 0;
    for (const d of targets) if (enqueue(jobs, "ai", d.id, 70)) queued += 1;
    writeJobs(root, jobs);
    console.log(`
\u{1F9F0} ${queued} job(s) IA mis en file (classement assist\xE9) \u2014 worker en arri\xE8re-plan.
`);
    return;
  }
  console.log(`
\u{1F4C2} Data-dir : ${root}`);
  console.log(`\u{1F4C4} Documents : ${docs.length}
`);
  console.log("\u2500\u2500 \xC0 classer \u2500\u2500");
  console.log(`  sans tag          : ${wTag}`);
  console.log(`  sans type         : ${wType}`);
  console.log(`  sans correspondant: ${wCorr}`);
  console.log(`  sans dossier      : ${wFolder}`);
  console.log(`  \xE0 v\xE9rifier        : ${review}`);
  console.log("\n\u2500\u2500 Taxonomies \u2500\u2500");
  console.log(`  tags inutilis\xE9s       : ${unusedTags.length} / ${tags.length}`);
  console.log(`  types inutilis\xE9s      : ${unusedTypes.length} / ${types.length}`);
  console.log(`  dossiers vides        : ${emptyFolders.length} / ${folders.length}`);
  console.log(`  correspondants doublons: ${dupCorr.length} groupe(s)`);
  console.log("\n\u2139\uFE0F  Options : --tags \xB7 --correspondents \xB7 --apply-safe [--dry-run]\n");
}
main();
