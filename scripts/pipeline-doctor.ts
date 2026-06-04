/* gedify:pipeline:inspect (et --retry-failed → gedify:pipeline:retry-failed)

   Inspection PUR-DISQUE de la file de jobs du pipeline documentaire
   (<DATA_DIR>/jobs/pipeline-jobs.json). Sans dépendances natives.

   - inspect        : compte les jobs par statut / type + derniers échecs.
   - --retry-failed : remet les jobs « failed » en « pending » (relance par le
                      worker au prochain tick). Ne touche à aucun document. */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./_shared";

type Job = {
  id: string;
  type: string;
  documentId: number;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
};

function jobsFile(root: string): string {
  return path.join(root, "jobs", "pipeline-jobs.json");
}

function readJobs(root: string): Job[] {
  const f = jobsFile(root);
  if (!existsSync(f)) return [];
  try {
    const parsed = JSON.parse(readFileSync(f, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as Job[]) : [];
  } catch {
    return [];
  }
}

function main() {
  const retry = process.argv.includes("--retry-failed");
  const root = dataDir();
  const jobs = readJobs(root);

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const j of jobs) {
    byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
    byType[j.type] = (byType[j.type] ?? 0) + 1;
  }

  console.log(`\n📂 Data-dir : ${root}`);
  console.log(`🧰 Jobs pipeline : ${jobs.length}\n`);
  console.log("── Par statut ──");
  for (const s of ["pending", "processing", "done", "failed", "skipped"]) {
    console.log(`  ${s.padEnd(12)} ${byStatus[s] ?? 0}`);
  }
  console.log("\n── Par type ──");
  for (const [t, n] of Object.entries(byType).sort()) console.log(`  ${t.padEnd(12)} ${n}`);

  const failed = jobs.filter((j) => j.status === "failed").slice(0, 15);
  if (failed.length > 0) {
    console.log("\n── Échecs récents ──");
    for (const j of failed) {
      console.log(`  #${j.documentId} ${j.type} (${j.attempts}/${j.maxAttempts}) : ${j.lastError ?? "—"}`);
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
    console.log(`\n🔁 ${n} job(s) échoué(s) remis en attente.`);
  } else if ((byStatus.failed ?? 0) > 0) {
    console.log(`\nℹ️  Relancer avec --retry-failed (gedify:pipeline:retry-failed).`);
  }
  console.log("");
}

main();
