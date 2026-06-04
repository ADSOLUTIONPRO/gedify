import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/pipeline-doctor.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path2 from "node:path";

// scripts/_shared.ts
import path from "node:path";
function dataDir() {
  return process.env.JSON_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || process.env.APP_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}

// scripts/pipeline-doctor.ts
function jobsFile(root) {
  return path2.join(root, "jobs", "pipeline-jobs.json");
}
function readJobs(root) {
  const f = jobsFile(root);
  if (!existsSync(f)) return [];
  try {
    const parsed = JSON.parse(readFileSync(f, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function main() {
  const retry = process.argv.includes("--retry-failed");
  const root = dataDir();
  const jobs = readJobs(root);
  const byStatus = {};
  const byType = {};
  for (const j of jobs) {
    byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
    byType[j.type] = (byType[j.type] ?? 0) + 1;
  }
  console.log(`
\u{1F4C2} Data-dir : ${root}`);
  console.log(`\u{1F9F0} Jobs pipeline : ${jobs.length}
`);
  console.log("\u2500\u2500 Par statut \u2500\u2500");
  for (const s of ["pending", "processing", "done", "failed", "skipped"]) {
    console.log(`  ${s.padEnd(12)} ${byStatus[s] ?? 0}`);
  }
  console.log("\n\u2500\u2500 Par type \u2500\u2500");
  for (const [t, n] of Object.entries(byType).sort()) console.log(`  ${t.padEnd(12)} ${n}`);
  const failed = jobs.filter((j) => j.status === "failed").slice(0, 15);
  if (failed.length > 0) {
    console.log("\n\u2500\u2500 \xC9checs r\xE9cents \u2500\u2500");
    for (const j of failed) {
      console.log(`  #${j.documentId} ${j.type} (${j.attempts}/${j.maxAttempts}) : ${j.lastError ?? "\u2014"}`);
    }
  }
  if (retry) {
    let n = 0;
    for (const j of jobs) {
      if (j.status === "failed") {
        j.status = "pending";
        j.attempts = 0;
        j.lastError = null;
        j.finishedAt = null;
        n += 1;
      }
    }
    if (n > 0) writeFileSync(jobsFile(root), JSON.stringify(jobs, null, 2), "utf8");
    console.log(`
\u{1F501} ${n} job(s) \xE9chou\xE9(s) remis en attente.`);
  } else if ((byStatus.failed ?? 0) > 0) {
    console.log(`
\u2139\uFE0F  Relancer avec --retry-failed (gedify:pipeline:retry-failed).`);
  }
  console.log("");
}
main();
