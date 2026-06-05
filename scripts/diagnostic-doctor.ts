/* Diagnostic GLOBAL Gedify (Partie 9). Sans tsx runtime, pur-disque.
   Agrège stockage + documents + jobs + intégrité en UN rapport JSON.
   LECTURE SEULE par défaut. `--save` écrit un rapport horodaté (création d'un
   nouveau fichier sous backups/reports/, jamais d'écrasement).

   Usage :
     (défaut)  : rapport texte lisible.
     --json    : rapport JSON complet (supervision / CI conteneur).
     --save    : écrit aussi backups/reports/diagnostic-<ts>.json. */

import { readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir, loadArray } from "./_shared";

type Doc = { id?: number; content?: string; deleted?: boolean; storedFilename?: string };
type Job = { type?: string; status?: string };
type DirUsage = { files: number; bytes: number };

function dirUsage(dir: string): DirUsage {
  let files = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else {
        try {
          bytes += statSync(full).size;
          files += 1;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return { files, bytes };
}

function listNames(dir: string): Set<string> {
  try {
    return new Set(readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name));
  } catch {
    return new Set();
  }
}

function fmtBytes(n: number): string {
  const u = ["o", "Ko", "Mo", "Go", "To"];
  if (!n) return "0 o";
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function main() {
  const root = dataDir();
  const filesDir = process.env.FILES_DIR?.trim() || path.join(root, "files");
  const backupsDir = process.env.BACKUPS_DIR?.trim() || path.join(root, "backups");

  const docs = loadArray<Doc>(root, "documents.json").filter((d) => !d.deleted);
  const activeIds = new Set<number>(docs.map((d) => Number(d.id)).filter(Number.isFinite));
  const originals = new Set<string>([
    ...listNames(path.join(filesDir, "originals")),
    ...listNames(path.join(root, "media", "originals")),
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

  const jobs = loadArray<Job>(root, "pipeline-jobs.json");
  const jobBy = (s: string) => jobs.filter((j) => j.status === s).length;

  const storage = {
    originals: dirUsage(path.join(filesDir, "originals")),
    thumbnails: dirUsage(path.join(filesDir, "thumbnails")),
    previews: dirUsage(path.join(filesDir, "previews")),
    pages: dirUsage(path.join(filesDir, "pages")),
    signed: dirUsage(path.join(filesDir, "signed")),
    backups: dirUsage(backupsDir),
  };
  const totalBytes = Object.values(storage).reduce((a, u) => a + u.bytes, 0);

  const warnings: string[] = [];
  const errors: string[] = [];
  if (withoutOriginal) errors.push(`${withoutOriginal} document(s) sans fichier original`);
  if (jobBy("failed")) warnings.push(`${jobBy("failed")} job(s) en erreur`);
  if (withoutOcr) warnings.push(`${withoutOcr} document(s) sans OCR`);
  if (orphanOriginals) warnings.push(`${orphanOriginals} fichier(s) original(aux) orphelin(s)`);
  if (!storage.backups.files) warnings.push("aucune sauvegarde présente");

  const report = {
    status: errors.length ? "error" : warnings.length ? "warning" : "ok",
    generatedAt: new Date().toISOString(),
    dataDir: root,
    documents: {
      total: docs.length,
      withoutOcr,
      withoutOriginal,
      orphanOriginals,
    },
    storage: { ...storage, totalBytes },
    jobs: {
      pending: jobBy("pending"),
      processing: jobBy("processing"),
      failed: jobBy("failed"),
      done: jobBy("done"),
      total: jobs.length,
    },
    warnings,
    errors,
  };

  if (process.argv.includes("--save")) {
    const dir = path.join(backupsDir, "reports");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const out = path.join(dir, `diagnostic-${stamp}.json`);
    writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
    console.log(`📝 Rapport écrit : ${out}`);
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n🩺 Diagnostic Gedify — ${root}`);
  console.log(`Statut global : ${report.status === "ok" ? "✅ ok" : report.status === "warning" ? "⚠️ warning" : "❌ error"}`);
  console.log("\n── Documents ──");
  console.log(`  total            : ${report.documents.total}`);
  console.log(`  sans OCR         : ${report.documents.withoutOcr}`);
  console.log(`  sans original    : ${report.documents.withoutOriginal}`);
  console.log(`  originaux orphelins: ${report.documents.orphanOriginals}`);
  console.log("\n── Stockage ──");
  console.log(`  originaux  : ${storage.originals.files} · ${fmtBytes(storage.originals.bytes)}`);
  console.log(`  miniatures : ${storage.thumbnails.files} · ${fmtBytes(storage.thumbnails.bytes)}`);
  console.log(`  aperçus    : ${storage.previews.files} · ${fmtBytes(storage.previews.bytes)}`);
  console.log(`  pages      : ${storage.pages.files} · ${fmtBytes(storage.pages.bytes)}`);
  console.log(`  signés     : ${storage.signed.files} · ${fmtBytes(storage.signed.bytes)}`);
  console.log(`  sauvegardes: ${storage.backups.files} · ${fmtBytes(storage.backups.bytes)}`);
  console.log(`  total      : ${fmtBytes(totalBytes)}`);
  console.log("\n── Jobs ──");
  console.log(`  en attente : ${report.jobs.pending}  ·  en cours : ${report.jobs.processing}  ·  échoués : ${report.jobs.failed}`);
  if (warnings.length) {
    console.log("\n⚠️  Avertissements :");
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (errors.length) {
    console.log("\n❌ Erreurs :");
    for (const e of errors) console.log(`  - ${e}`);
  }
  console.log("\nℹ️  Options : --json · --save   (lecture seule ; --save crée un rapport horodaté)\n");
}

main();
