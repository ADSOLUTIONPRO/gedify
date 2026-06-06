import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   File d'attente de jobs du pipeline documentaire (Partie 2).

   Stockage JSON dédié, ÉPHÉMÈRE (les jobs sont des tâches de traitement, pas des
   données métier → non inclus dans le backup). Sérialisation des écritures par
   mutex in-process. Conçu pour un déploiement mono-instance (worker unique).
   N'altère JAMAIS un document : les handlers réutilisent les fonctions moteur.
   ──────────────────────────────────────────────────────────────────────── */

export type JobType = "ocr" | "thumbnail" | "preview" | "index" | "ai";
export type JobStatus = "pending" | "processing" | "done" | "failed" | "skipped";

export type PipelineJob = {
  id: string;
  type: JobType;
  documentId: number;
  payload: Record<string, unknown> | null;
  status: JobStatus;
  priority: number; // plus petit = plus prioritaire
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

const DONE_KEEP = 500; // plafond des jobs terminés/échoués conservés

function file(): string {
  return path.join(getDataDir(), "jobs", "pipeline-jobs.json");
}

/* ── Mutex d'écriture (chaîne de promesses) ──────────────────────────────── */
let chain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readAllRaw(): Promise<PipelineJob[]> {
  try {
    const raw = await fs.readFile(file(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PipelineJob[]) : [];
  } catch {
    return [];
  }
}

async function writeAllRaw(jobs: PipelineJob[]): Promise<void> {
  const f = file();
  await fs.mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(jobs, null, 2), "utf8");
  await fs.rename(tmp, f);
}

export async function listJobs(): Promise<PipelineJob[]> {
  return readAllRaw();
}

export type JobStats = {
  total: number;
  byStatus: Record<JobStatus, number>;
  byType: Partial<Record<JobType, number>>;
  pending: number;
  processing: number;
  failed: number;
  lastFinishedAt: string | null;
};

export async function jobStats(): Promise<JobStats> {
  const jobs = await readAllRaw();
  const byStatus = { pending: 0, processing: 0, done: 0, failed: 0, skipped: 0 } as Record<JobStatus, number>;
  const byType: Partial<Record<JobType, number>> = {};
  let lastFinishedAt: string | null = null;
  for (const j of jobs) {
    byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
    if (j.status === "pending" || j.status === "processing") byType[j.type] = (byType[j.type] ?? 0) + 1;
    if (j.finishedAt && (!lastFinishedAt || j.finishedAt > lastFinishedAt)) lastFinishedAt = j.finishedAt;
  }
  return {
    total: jobs.length,
    byStatus,
    byType,
    pending: byStatus.pending,
    processing: byStatus.processing,
    failed: byStatus.failed,
    lastFinishedAt,
  };
}

/** Ajoute un job (dé-doublonnage : pas de doublon pending même type+document). */
export async function enqueueJob(
  type: JobType,
  documentId: number,
  opts: { payload?: Record<string, unknown>; priority?: number; maxAttempts?: number } = {},
): Promise<PipelineJob | null> {
  return withLock(async () => {
    const jobs = await readAllRaw();
    const dup = jobs.find(
      (j) => j.type === type && j.documentId === documentId && (j.status === "pending" || j.status === "processing"),
    );
    if (dup) return dup;
    const job: PipelineJob = {
      id: randomUUID(),
      type,
      documentId,
      payload: opts.payload ?? null,
      status: "pending",
      priority: opts.priority ?? 100,
      attempts: 0,
      maxAttempts: opts.maxAttempts ?? 3,
      lastError: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
    };
    jobs.push(job);
    await writeAllRaw(jobs);
    return job;
  });
}

/** Réclame le prochain job à traiter (priorité puis ancienneté) et le marque processing. */
export async function claimNextJob(): Promise<PipelineJob | null> {
  return withLock(async () => {
    const jobs = await readAllRaw();
    const pending = jobs
      .filter((j) => j.status === "pending")
      .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
    const next = pending[0];
    if (!next) return null;
    next.status = "processing";
    next.startedAt = new Date().toISOString();
    next.attempts += 1;
    await writeAllRaw(jobs);
    return { ...next };
  });
}

export async function markJobDone(id: string): Promise<void> {
  await withLock(async () => {
    const jobs = await readAllRaw();
    const j = jobs.find((x) => x.id === id);
    if (j) {
      j.status = "done";
      j.finishedAt = new Date().toISOString();
      j.lastError = null;
    }
    await writeAllRaw(prune(jobs));
  });
}

export async function markJobFailed(id: string, error: string): Promise<void> {
  await withLock(async () => {
    const jobs = await readAllRaw();
    const j = jobs.find((x) => x.id === id);
    if (j) {
      j.lastError = error.slice(0, 500);
      if (j.attempts >= j.maxAttempts) {
        j.status = "failed";
        j.finishedAt = new Date().toISOString();
      } else {
        j.status = "pending"; // nouvelle tentative ultérieure
        j.startedAt = null;
      }
    }
    await writeAllRaw(prune(jobs));
  });
}

/** Remet les jobs échoués en attente (relance manuelle). */
export async function retryFailedJobs(type?: JobType): Promise<number> {
  return withLock(async () => {
    const jobs = await readAllRaw();
    let n = 0;
    for (const j of jobs) {
      if (j.status === "failed" && (!type || j.type === type)) {
        j.status = "pending";
        j.attempts = 0;
        j.startedAt = null;
        j.finishedAt = null;
        j.lastError = null;
        n += 1;
      }
    }
    if (n > 0) await writeAllRaw(jobs);
    return n;
  });
}

/**
 * Reprise des jobs INTERROMPUS : un job resté « processing » au-delà de `maxAgeMs`
 * (redémarrage du conteneur en plein traitement, ou étape figée passée au travers
 * des timeouts) est relancé — repassé en `pending` (nouvelle tentative) ou marqué
 * `failed` si les tentatives sont épuisées. À appeler au démarrage + périodiquement.
 * Délai par défaut : GEDIFY_JOB_STUCK_MS (sinon 15 min) — bien au-delà des timeouts
 * d'étape, donc ne récupère JAMAIS un job légitimement en cours.
 */
export async function reclaimStuckJobs(maxAgeMs?: number): Promise<number> {
  const limit = (() => {
    if (typeof maxAgeMs === "number" && maxAgeMs > 0) return maxAgeMs;
    const n = Number(process.env.GEDIFY_JOB_STUCK_MS);
    return Number.isFinite(n) && n > 0 ? n : 15 * 60_000;
  })();
  return withLock(async () => {
    const jobs = await readAllRaw();
    const cutoff = Date.now() - limit;
    let n = 0;
    for (const j of jobs) {
      if (j.status !== "processing") continue;
      const started = j.startedAt ? Date.parse(j.startedAt) : 0;
      if (started && started > cutoff) continue; // encore dans les temps
      if (j.attempts >= j.maxAttempts) {
        j.status = "failed";
        j.finishedAt = new Date().toISOString();
        j.lastError = j.lastError ?? "interrompu (redémarrage ou blocage prolongé)";
      } else {
        j.status = "pending"; // sera repris par le worker
        j.startedAt = null;
        j.lastError = "repris après interruption";
      }
      n += 1;
    }
    if (n > 0) await writeAllRaw(prune(jobs));
    return n;
  });
}

/** Plafonne les jobs terminés/échoués (les plus anciens supprimés). */
function prune(jobs: PipelineJob[]): PipelineJob[] {
  const active = jobs.filter((j) => j.status === "pending" || j.status === "processing");
  const finished = jobs
    .filter((j) => j.status === "done" || j.status === "failed" || j.status === "skipped")
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))
    .slice(0, DONE_KEEP);
  return [...active, ...finished];
}
