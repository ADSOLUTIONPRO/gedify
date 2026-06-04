import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/previews-doctor.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path2 from "node:path";
import { randomUUID } from "node:crypto";

// scripts/_shared.ts
import path from "node:path";
function dataDir() {
  return process.env.JSON_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || process.env.APP_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}

// scripts/previews-doctor.ts
function envDir(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}
function filesDir(root) {
  return envDir("FILES_DIR") ?? path2.join(root, "files");
}
function listFiles(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}
function listDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
function webpId(name) {
  const m = name.match(/^(\d+)\.webp$/);
  return m ? Number(m[1]) : null;
}
function dirBytes(dir) {
  let total = 0;
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path2.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        try {
          total += statSync(full).size;
        } catch {
        }
      }
    }
  };
  walk(dir);
  return total;
}
function human(n) {
  if (!n) return "0 o";
  const u = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}
function activeDocs(root) {
  const file = path2.join(root, "engine", "documents.json");
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((d) => !d.deleted) : [];
  } catch {
    return [];
  }
}
function jobsFile(root) {
  return path2.join(root, "jobs", "pipeline-jobs.json");
}
function readJobs(root) {
  try {
    const parsed = JSON.parse(readFileSync(jobsFile(root), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
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
  if (jobs.some((j) => j.type === type && j.documentId === documentId && (j.status === "pending" || j.status === "processing"))) {
    return false;
  }
  jobs.push({
    id: randomUUID(),
    type,
    documentId,
    payload: null,
    status: "pending",
    priority,
    attempts: 0,
    maxAttempts: 3,
    lastError: null,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    startedAt: null,
    finishedAt: null
  });
  return true;
}
function main() {
  const argv = process.argv;
  const clean = argv.includes("--clean");
  const genMissing = argv.includes("--generate-missing");
  const regenAll = argv.includes("--regenerate-all");
  const root = dataDir();
  const f = filesDir(root);
  const thumbDirs = [path2.join(f, "thumbnails"), path2.join(root, "media", "thumbnails")];
  const previewDir = path2.join(f, "previews");
  const pagesDir = path2.join(f, "pages");
  const originalDirs = [path2.join(f, "originals"), path2.join(root, "media", "originals")];
  const docs = activeDocs(root);
  const activeIds = new Set(docs.map((d) => d.id).filter((n) => typeof n === "number"));
  const originalNames = new Set(originalDirs.flatMap(listFiles));
  const thumbFiles = thumbDirs.flatMap((d) => listFiles(d).map((n) => ({ dir: d, name: n, id: webpId(n) })));
  const previewFiles = listFiles(previewDir).map((n) => ({ dir: previewDir, name: n, id: webpId(n) }));
  const pageDirIds = listDirs(pagesDir).map((n) => ({ name: n, id: Number(n) }));
  const thumbIds = new Set(thumbFiles.map((x) => x.id).filter((n) => n != null));
  const previewIds = new Set(previewFiles.map((x) => x.id).filter((n) => n != null));
  const pageIds = new Set(pageDirIds.map((x) => x.id).filter((n) => Number.isFinite(n)));
  let missingThumb = 0;
  let missingPreview = 0;
  let missingPages = 0;
  let missingOriginal = 0;
  for (const d of docs) {
    if (typeof d.id !== "number") continue;
    if (!thumbIds.has(d.id)) missingThumb += 1;
    if (!previewIds.has(d.id)) missingPreview += 1;
    if (!pageIds.has(d.id)) missingPages += 1;
    if (d.storedFilename && !originalNames.has(d.storedFilename)) missingOriginal += 1;
  }
  const orphanThumbs = thumbFiles.filter((x) => x.id != null && !activeIds.has(x.id));
  const orphanPreviews = previewFiles.filter((x) => x.id != null && !activeIds.has(x.id));
  const orphanPageDirs = pageDirIds.filter((x) => Number.isFinite(x.id) && !activeIds.has(x.id));
  console.log(`
\u{1F4C2} Data-dir : ${root}`);
  console.log(`\u{1F4C1} Files-dir : ${f}
`);
  console.log("\u2500\u2500 Documents vs d\xE9riv\xE9s \u2500\u2500");
  console.log(`  documents actifs       : ${docs.length}`);
  console.log(`  ${missingThumb === 0 ? "\u2705" : "\u26A0\uFE0F "} miniatures manquantes : ${missingThumb}  (pr\xEAtes : ${docs.length - missingThumb})`);
  console.log(`  ${missingPreview === 0 ? "\u2705" : "\u26A0\uFE0F "} aper\xE7us manquants     : ${missingPreview}  (pr\xEAts : ${docs.length - missingPreview})`);
  console.log(`  pages rendues (dossiers) : ${pageIds.size}  (sans pages : ${missingPages})`);
  console.log(`  ${missingOriginal === 0 ? "\u2705" : "\u274C"} originaux manquants   : ${missingOriginal}`);
  console.log("\n\u2500\u2500 Tailles \u2500\u2500");
  console.log(`  miniatures : ${human(dirBytes(path2.join(f, "thumbnails")) + dirBytes(path2.join(root, "media", "thumbnails")))}`);
  console.log(`  aper\xE7us    : ${human(dirBytes(previewDir))}`);
  console.log(`  pages      : ${human(dirBytes(pagesDir))}`);
  console.log("\n\u2500\u2500 Orphelins \u2500\u2500");
  console.log(`  miniatures : ${orphanThumbs.length} \xB7 aper\xE7us : ${orphanPreviews.length} \xB7 dossiers pages : ${orphanPageDirs.length}`);
  if (genMissing || regenAll) {
    const jobs = readJobs(root);
    let queued = 0;
    for (const d of docs) {
      if (typeof d.id !== "number") continue;
      if (regenAll || !thumbIds.has(d.id)) {
        if (enqueue(jobs, "thumbnail", d.id, 90)) queued += 1;
      }
      if (regenAll || !previewIds.has(d.id)) {
        if (enqueue(jobs, "preview", d.id, 110)) queued += 1;
      }
    }
    writeJobs(root, jobs);
    console.log(`
\u{1F9F0} ${queued} job(s) mis en file \u2014 le worker de l'app les traitera en arri\xE8re-plan.`);
  } else if (clean) {
    let deleted = 0;
    for (const x of [...orphanThumbs, ...orphanPreviews]) {
      try {
        rmSync(path2.join(x.dir, x.name), { force: true });
        deleted += 1;
      } catch {
      }
    }
    for (const x of orphanPageDirs) {
      try {
        rmSync(path2.join(pagesDir, x.name), { recursive: true, force: true });
        deleted += 1;
      } catch {
      }
    }
    console.log(`
\u{1F9F9} ${deleted} \xE9l\xE9ment(s) orphelin(s) supprim\xE9(s).`);
  } else {
    const hints = [];
    if (missingThumb + missingPreview > 0) hints.push("--generate-missing pour g\xE9n\xE9rer ce qui manque");
    if (orphanThumbs.length + orphanPreviews.length + orphanPageDirs.length > 0) hints.push("--clean pour supprimer les orphelins");
    if (hints.length) console.log(`
\u2139\uFE0F  Options : ${hints.join(" \xB7 ")}`);
  }
  console.log("");
  if (missingOriginal > 0) process.exitCode = 1;
}
main();
