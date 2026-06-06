import "server-only";

import {
  readStore,
  STORE,
  thumbnailExists,
  previewExists,
  type EngineDocument,
} from "@/lib/engine/stores";
import { enqueueJob, retryFailedJobs, reclaimStuckJobs, type JobType } from "@/lib/jobs/job-store";
import { kickJobWorker } from "@/lib/jobs/job-worker";

/* Actions de retraitement du pipeline, partagées par l'API admin et l'assistant
   IA. Met des jobs en file (le worker traite en arrière-plan). */

export const PIPELINE_ACTIONS = [
  "ocr-missing",
  "ocr-all",
  "thumbnails-missing",
  "previews-missing",
  "reindex-all",
  "ai-unclassified",
  "ai-all",
  "retry-failed",
  "reclaim-stuck",
] as const;
export type PipelineActionName = (typeof PIPELINE_ACTIONS)[number];

export function isPipelineAction(x: string): x is PipelineActionName {
  return (PIPELINE_ACTIONS as readonly string[]).includes(x);
}

async function activeDocs(): Promise<EngineDocument[]> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  return docs.filter((d) => !d.deleted);
}

export type PipelineActionResult = { action: string; queued?: number; requeued?: number };

/** Exécute une action de pipeline (enqueue de jobs / relance). Lève si inconnue. */
export async function runPipelineAction(action: string): Promise<PipelineActionResult> {
  if (action === "retry-failed") {
    const requeued = await retryFailedJobs();
    kickJobWorker();
    return { action, requeued };
  }

  // « Relancer les traitements bloqués » : jobs coincés en « processing »
  // (interruption / blocage) → repassés en attente (forçage immédiat, maxAge 0).
  if (action === "reclaim-stuck") {
    const requeued = await reclaimStuckJobs(0);
    kickJobWorker();
    return { action, requeued };
  }

  let queued = 0;
  const enqueueFor = async (
    type: JobType,
    predicate: (d: EngineDocument) => Promise<boolean> | boolean,
    priority: number,
  ) => {
    for (const d of await activeDocs()) {
      if (await predicate(d)) {
        const job = await enqueueJob(type, d.id, { priority });
        if (job) queued += 1;
      }
    }
  };

  switch (action) {
    case "ocr-missing":
      await enqueueFor("ocr", (d) => !(d.content ?? "").trim(), 60);
      break;
    case "ocr-all":
      await enqueueFor("ocr", () => true, 80);
      break;
    case "thumbnails-missing":
      await enqueueFor("thumbnail", async (d) => !(await thumbnailExists(d.id)), 90);
      break;
    case "previews-missing":
      await enqueueFor("preview", async (d) => !(await previewExists(d.id)), 110);
      break;
    case "reindex-all":
      await enqueueFor("index", () => true, 120);
      break;
    case "ai-unclassified":
      await enqueueFor(
        "ai",
        (d) => Boolean((d.content ?? "").trim()) && (d.correspondent == null || d.document_type == null),
        70,
      );
      break;
    case "ai-all":
      await enqueueFor("ai", (d) => Boolean((d.content ?? "").trim()), 90);
      break;
    default:
      throw new Error(`Action pipeline inconnue : ${action}`);
  }

  kickJobWorker();
  return { action, queued };
}
