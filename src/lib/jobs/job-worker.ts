import "server-only";

import { claimNextJob, markJobDone, markJobFailed } from "@/lib/jobs/job-store";
import { runJob } from "@/lib/jobs/job-handlers";

/* ────────────────────────────────────────────────────────────────────────
   Worker du pipeline : poller in-process (mono-instance) démarré au boot via
   instrumentation.ts. Traite les jobs en attente UN PAR UN (concurrence 1 pour
   ne pas saturer le pool OCR Tesseract qui gère déjà sa propre parallélisation).
   Désactivable par GEDIFY_JOBS_WORKER=0. Best-effort, ne lève jamais.
   ──────────────────────────────────────────────────────────────────────── */

let started = false;
let ticking = false;

function disabled(): boolean {
  return process.env.GEDIFY_JOBS_WORKER?.trim() === "0";
}

function intervalMs(): number {
  const n = Number(process.env.GEDIFY_JOBS_INTERVAL_MS);
  return Number.isFinite(n) && n >= 500 ? n : 3000;
}

/** Traite jusqu'à `budget` jobs sur un tick, tant qu'il y en a. */
async function tick(budget = 5): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    for (let i = 0; i < budget; i += 1) {
      const job = await claimNextJob();
      if (!job) break;
      try {
        await runJob(job);
        await markJobDone(job.id);
      } catch (e) {
        await markJobFailed(job.id, e instanceof Error ? e.message : String(e));
      }
    }
  } catch (e) {
    console.error("[jobs] tick échoué :", e instanceof Error ? e.message : e);
  } finally {
    ticking = false;
  }
}

export function startJobWorker(): void {
  if (started || disabled()) return;
  started = true;
  const period = intervalMs();
  console.log(`[jobs] worker pipeline démarré (intervalle ${period} ms).`);
  const timer = setInterval(() => void tick(), period);
  timer.unref?.();
}

/** Traitement immédiat (utile après un enqueue, sans attendre le prochain tick). */
export function kickJobWorker(): void {
  if (disabled()) return;
  void tick();
}
