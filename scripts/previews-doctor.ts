/* Maintenance PUR-DISQUE des fichiers dérivés (miniatures, aperçus, pages).
   Sans dépendances natives : la génération se fait en METTANT DES JOBS en file
   (<DATA_DIR>/jobs/pipeline-jobs.json) que le worker de l'app traite ensuite.

   - inspect (défaut)   : docs, dérivés présents/manquants, orphelins, tailles.
   - --generate-missing : enfile des jobs thumbnail/preview pour ce qui manque.
   - --regenerate-all   : enfile des jobs thumbnail/preview pour TOUS les docs.
   - --clean            : supprime les fichiers dérivés orphelins.

   NB : à lancer de préférence quand le worker est calme (lecture/écriture
   concurrente du fichier de jobs ; les jobs sont idempotents et relançables). */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir } from "./_shared";

function envDir(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}
function filesDir(root: string): string {
  return envDir("FILES_DIR") ?? path.join(root, "files");
}

function listFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}
function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
function webpId(name: string): number | null {
  const m = name.match(/^(\d+)\.webp$/);
  return m ? Number(m[1]) : null;
}
function dirBytes(dir: string): number {
  let total = 0;
  const walk = (d: string) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) {
        try {
          total += statSync(full).size;
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk(dir);
  return total;
}
function human(n: number): string {
  if (!n) return "0 o";
  const u = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

type Doc = { id?: number; storedFilename?: string; deleted?: boolean };
function activeDocs(root: string): Doc[] {
  const file = path.join(root, "engine", "documents.json");
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as Doc[]).filter((d) => !d.deleted) : [];
  } catch {
    return [];
  }
}

/* ── File de jobs (enfilage pur-disque) ──────────────────────────────────── */
type Job = {
  id: string;
  type: string;
  documentId: number;
  payload: null;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  lastError: null;
  createdAt: string;
  startedAt: null;
  finishedAt: null;
};
function jobsFile(root: string): string {
  return path.join(root, "jobs", "pipeline-jobs.json");
}
function readJobs(root: string): Job[] {
  try {
    const parsed = JSON.parse(readFileSync(jobsFile(root), "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as Job[]) : [];
  } catch {
    return [];
  }
}
function writeJobs(root: string, jobs: Job[]): void {
  const f = jobsFile(root);
  mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(jobs, null, 2), "utf8");
  renameSync(tmp, f);
}
function enqueue(jobs: Job[], type: string, documentId: number, priority: number): boolean {
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
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
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
  const thumbDirs = [path.join(f, "thumbnails"), path.join(root, "media", "thumbnails")];
  const previewDir = path.join(f, "previews");
  const pagesDir = path.join(f, "pages");
  const originalDirs = [path.join(f, "originals"), path.join(root, "media", "originals")];

  const docs = activeDocs(root);
  const activeIds = new Set(docs.map((d) => d.id).filter((n): n is number => typeof n === "number"));
  const originalNames = new Set(originalDirs.flatMap(listFiles));

  const thumbFiles = thumbDirs.flatMap((d) => listFiles(d).map((n) => ({ dir: d, name: n, id: webpId(n) })));
  const previewFiles = listFiles(previewDir).map((n) => ({ dir: previewDir, name: n, id: webpId(n) }));
  const pageDirIds = listDirs(pagesDir).map((n) => ({ name: n, id: Number(n) }));
  const thumbIds = new Set(thumbFiles.map((x) => x.id).filter((n): n is number => n != null));
  const previewIds = new Set(previewFiles.map((x) => x.id).filter((n): n is number => n != null));
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

  console.log(`\n📂 Data-dir : ${root}`);
  console.log(`📁 Files-dir : ${f}\n`);
  console.log("── Documents vs dérivés ──");
  console.log(`  documents actifs       : ${docs.length}`);
  console.log(`  ${missingThumb === 0 ? "✅" : "⚠️ "} miniatures manquantes : ${missingThumb}  (prêtes : ${docs.length - missingThumb})`);
  console.log(`  ${missingPreview === 0 ? "✅" : "⚠️ "} aperçus manquants     : ${missingPreview}  (prêts : ${docs.length - missingPreview})`);
  console.log(`  pages rendues (dossiers) : ${pageIds.size}  (sans pages : ${missingPages})`);
  console.log(`  ${missingOriginal === 0 ? "✅" : "❌"} originaux manquants   : ${missingOriginal}`);
  console.log("\n── Tailles ──");
  console.log(`  miniatures : ${human(dirBytes(path.join(f, "thumbnails")) + dirBytes(path.join(root, "media", "thumbnails")))}`);
  console.log(`  aperçus    : ${human(dirBytes(previewDir))}`);
  console.log(`  pages      : ${human(dirBytes(pagesDir))}`);
  console.log("\n── Orphelins ──");
  console.log(`  miniatures : ${orphanThumbs.length} · aperçus : ${orphanPreviews.length} · dossiers pages : ${orphanPageDirs.length}`);

  if (genMissing || regenAll) {
    const jobs = readJobs(root);
    let queued = 0;
    for (const d of docs) {
      if (typeof d.id !== "number") continue;
      if (regenAll || !thumbIds.has(d.id)) if (enqueue(jobs, "thumbnail", d.id, 90)) queued += 1;
      if (regenAll || !previewIds.has(d.id)) if (enqueue(jobs, "preview", d.id, 110)) queued += 1;
    }
    writeJobs(root, jobs);
    console.log(`\n🧰 ${queued} job(s) mis en file — le worker de l'app les traitera en arrière-plan.`);
  } else if (clean) {
    let deleted = 0;
    for (const x of [...orphanThumbs, ...orphanPreviews]) {
      try {
        rmSync(path.join(x.dir, x.name), { force: true });
        deleted += 1;
      } catch {
        /* ignore */
      }
    }
    for (const x of orphanPageDirs) {
      try {
        rmSync(path.join(pagesDir, x.name), { recursive: true, force: true });
        deleted += 1;
      } catch {
        /* ignore */
      }
    }
    console.log(`\n🧹 ${deleted} élément(s) orphelin(s) supprimé(s).`);
  } else {
    const hints: string[] = [];
    if (missingThumb + missingPreview > 0) hints.push("--generate-missing pour générer ce qui manque");
    if (orphanThumbs.length + orphanPreviews.length + orphanPageDirs.length > 0) hints.push("--clean pour supprimer les orphelins");
    if (hints.length) console.log(`\nℹ️  Options : ${hints.join(" · ")}`);
  }
  console.log("");
  if (missingOriginal > 0) process.exitCode = 1;
}

main();
