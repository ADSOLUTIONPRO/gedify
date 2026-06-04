/* Maintenance OCR / indexation PUR-DISQUE (Partie 4). Sans deps natives : la
   (ré)génération se fait en METTANT DES JOBS en file (le worker de l'app traite).

   - inspect (défaut)    : état OCR des documents.
   - --run-missing       : enfile un job ocr pour chaque doc sans texte.
   - --retry-failed      : enfile un job ocr pour chaque doc ocr_status=failed.
   - --reindex           : enfile un job index pour TOUS les docs (rebuild).
   - --index-inspect     : état d'indexation.

   À lancer de préférence worker calme (fichier de jobs partagé ; jobs idempotents). */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir } from "./_shared";

type Doc = {
  id?: number;
  content?: string;
  deleted?: boolean;
  ocr_status?: string;
  ocr_quality?: string;
  index_status?: string;
};

function readDocs(root: string): Doc[] {
  const file = path.join(root, "engine", "documents.json");
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as Doc[]).filter((d) => !d.deleted) : [];
  } catch {
    return [];
  }
}

type Job = {
  id: string; type: string; documentId: number; payload: null; status: string;
  priority: number; attempts: number; maxAttempts: number; lastError: null;
  createdAt: string; startedAt: null; finishedAt: null;
};
function jobsFile(root: string) {
  return path.join(root, "jobs", "pipeline-jobs.json");
}
function readJobs(root: string): Job[] {
  try {
    const p = JSON.parse(readFileSync(jobsFile(root), "utf8")) as unknown;
    return Array.isArray(p) ? (p as Job[]) : [];
  } catch {
    return [];
  }
}
function writeJobs(root: string, jobs: Job[]) {
  const f = jobsFile(root);
  mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(jobs, null, 2), "utf8");
  renameSync(tmp, f);
}
function enqueue(jobs: Job[], type: string, documentId: number, priority: number): boolean {
  if (jobs.some((j) => j.type === type && j.documentId === documentId && (j.status === "pending" || j.status === "processing"))) return false;
  jobs.push({
    id: randomUUID(), type, documentId, payload: null, status: "pending",
    priority, attempts: 0, maxAttempts: 3, lastError: null,
    createdAt: new Date().toISOString(), startedAt: null, finishedAt: null,
  });
  return true;
}

function main() {
  const argv = process.argv;
  const runMissing = argv.includes("--run-missing");
  const retryFailed = argv.includes("--retry-failed");
  const reindex = argv.includes("--reindex");
  const indexInspect = argv.includes("--index-inspect");

  const root = dataDir();
  const docs = readDocs(root);

  const has = (d: Doc) => Boolean((d.content ?? "").trim());
  const ready = docs.filter((d) => d.ocr_status === "ready").length;
  const failed = docs.filter((d) => d.ocr_status === "failed").length;
  const processing = docs.filter((d) => d.ocr_status === "processing").length;
  const empty = docs.filter((d) => !has(d)).length;
  const low = docs.filter((d) => d.ocr_quality === "low").length;
  const short = docs.filter((d) => has(d) && (d.content ?? "").trim().length < 30).length;

  console.log(`\n📂 Data-dir : ${root}`);
  console.log(`📄 Documents : ${docs.length}\n`);

  if (indexInspect) {
    const idx = (s: string) => docs.filter((d) => d.index_status === s).length;
    console.log("── Indexation ──");
    console.log(`  indexés (ready) : ${idx("ready")}`);
    console.log(`  en attente      : ${idx("pending")}`);
    console.log(`  en cours        : ${idx("processing")}`);
    console.log(`  en erreur       : ${idx("failed")}`);
    console.log("");
    return;
  }

  console.log("── OCR ──");
  console.log(`  ✅ OCR prêts        : ${ready}`);
  console.log(`  ${failed ? "❌" : "  "} OCR en erreur    : ${failed}`);
  console.log(`  ${processing ? "⏳" : "  "} OCR en cours     : ${processing}`);
  console.log(`  ${empty ? "⚠️ " : "  "}sans texte (vide) : ${empty}`);
  console.log(`  ${low ? "⚠️ " : "  "}OCR faible        : ${low}`);
  console.log(`  texte court (<30) : ${short}`);

  if (runMissing || retryFailed || reindex) {
    const jobs = readJobs(root);
    let queued = 0;
    for (const d of docs) {
      if (typeof d.id !== "number") continue;
      if (reindex) {
        if (enqueue(jobs, "index", d.id, 120)) queued += 1;
      } else {
        const needs = (runMissing && !has(d)) || (retryFailed && d.ocr_status === "failed");
        if (needs && enqueue(jobs, "ocr", d.id, 60)) queued += 1;
      }
    }
    writeJobs(root, jobs);
    console.log(`\n🧰 ${queued} job(s) ${reindex ? "index" : "ocr"} mis en file — le worker traitera en arrière-plan.`);
  } else {
    const hints: string[] = [];
    if (empty > 0) hints.push("--run-missing");
    if (failed > 0) hints.push("--retry-failed");
    if (hints.length) console.log(`\nℹ️  Options : ${hints.join(" · ")} · --reindex`);
  }
  console.log("");
}

main();
