import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit/audit-store";
import { jsonError } from "@/lib/api-utils";
import {
  readStore,
  STORE,
  thumbnailExists,
  previewExists,
  type EngineDocument,
} from "@/lib/engine/stores";
import { enqueueJob, jobStats, retryFailedJobs, type JobType } from "@/lib/jobs/job-store";
import { kickJobWorker } from "@/lib/jobs/job-worker";

/* Pilotage du pipeline : GET = statistiques des jobs ; POST = mise en file de
   lots de retraitement (OCR/miniatures/aperçus/index) ou relance des échecs. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function activeDocs(): Promise<EngineDocument[]> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  return docs.filter((d) => !d.deleted);
}

export async function GET(request: NextRequest) {
  const deny = await requirePermission(request, "admin.access");
  if (deny) return deny;
  try {
    return NextResponse.json(await jobStats());
  } catch (error) {
    return jsonError("Impossible de lire l'état du pipeline", error);
  }
}

export async function POST(request: NextRequest) {
  const deny = await requirePermission(request, "admin.access");
  if (deny) return deny;

  let action = "";
  try {
    action = String(((await request.json()) as { action?: string }).action ?? "");
  } catch {
    /* corps vide */
  }

  try {
    let queued = 0;

    if (action === "retry-failed") {
      const n = await retryFailedJobs();
      kickJobWorker();
      await recordAudit({ action: "pipeline.retry-failed", details: `${n} job(s) relancé(s)` });
      return NextResponse.json({ ok: true, action, requeued: n });
    }

    const enqueueFor = async (
      type: JobType,
      predicate: (d: EngineDocument) => Promise<boolean> | boolean,
      priority = 100,
    ) => {
      const docs = await activeDocs();
      for (const d of docs) {
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
      default:
        return jsonError("Action inconnue", `action=${action}`, 400);
    }

    kickJobWorker();
    await recordAudit({ action: `pipeline.${action}`, details: `${queued} job(s) en file` });
    return NextResponse.json({ ok: true, action, queued });
  } catch (error) {
    return jsonError("Impossible de planifier le retraitement", error);
  }
}
