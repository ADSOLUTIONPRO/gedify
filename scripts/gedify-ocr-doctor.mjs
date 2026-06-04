import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/ocr-doctor.ts
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path2 from "node:path";
import { randomUUID } from "node:crypto";

// scripts/_shared.ts
import path from "node:path";
function dataDir() {
  return process.env.JSON_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || process.env.APP_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}

// scripts/ocr-doctor.ts
function readDocs(root) {
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
    const p = JSON.parse(readFileSync(jobsFile(root), "utf8"));
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
  const runMissing = argv.includes("--run-missing");
  const retryFailed = argv.includes("--retry-failed");
  const reindex = argv.includes("--reindex");
  const indexInspect = argv.includes("--index-inspect");
  const root = dataDir();
  const docs = readDocs(root);
  const has = (d) => Boolean((d.content ?? "").trim());
  const ready = docs.filter((d) => d.ocr_status === "ready").length;
  const failed = docs.filter((d) => d.ocr_status === "failed").length;
  const processing = docs.filter((d) => d.ocr_status === "processing").length;
  const empty = docs.filter((d) => !has(d)).length;
  const low = docs.filter((d) => d.ocr_quality === "low").length;
  const short = docs.filter((d) => has(d) && (d.content ?? "").trim().length < 30).length;
  console.log(`
\u{1F4C2} Data-dir : ${root}`);
  console.log(`\u{1F4C4} Documents : ${docs.length}
`);
  if (indexInspect) {
    const idx = (s) => docs.filter((d) => d.index_status === s).length;
    console.log("\u2500\u2500 Indexation \u2500\u2500");
    console.log(`  index\xE9s (ready) : ${idx("ready")}`);
    console.log(`  en attente      : ${idx("pending")}`);
    console.log(`  en cours        : ${idx("processing")}`);
    console.log(`  en erreur       : ${idx("failed")}`);
    console.log("");
    return;
  }
  console.log("\u2500\u2500 OCR \u2500\u2500");
  console.log(`  \u2705 OCR pr\xEAts        : ${ready}`);
  console.log(`  ${failed ? "\u274C" : "  "} OCR en erreur    : ${failed}`);
  console.log(`  ${processing ? "\u23F3" : "  "} OCR en cours     : ${processing}`);
  console.log(`  ${empty ? "\u26A0\uFE0F " : "  "}sans texte (vide) : ${empty}`);
  console.log(`  ${low ? "\u26A0\uFE0F " : "  "}OCR faible        : ${low}`);
  console.log(`  texte court (<30) : ${short}`);
  if (runMissing || retryFailed || reindex) {
    const jobs = readJobs(root);
    let queued = 0;
    for (const d of docs) {
      if (typeof d.id !== "number") continue;
      if (reindex) {
        if (enqueue(jobs, "index", d.id, 120)) queued += 1;
      } else {
        const needs = runMissing && !has(d) || retryFailed && d.ocr_status === "failed";
        if (needs && enqueue(jobs, "ocr", d.id, 60)) queued += 1;
      }
    }
    writeJobs(root, jobs);
    console.log(`
\u{1F9F0} ${queued} job(s) ${reindex ? "index" : "ocr"} mis en file \u2014 le worker traitera en arri\xE8re-plan.`);
  } else {
    const hints = [];
    if (empty > 0) hints.push("--run-missing");
    if (failed > 0) hints.push("--retry-failed");
    if (hints.length) console.log(`
\u2139\uFE0F  Options : ${hints.join(" \xB7 ")} \xB7 --reindex`);
  }
  console.log("");
}
main();
