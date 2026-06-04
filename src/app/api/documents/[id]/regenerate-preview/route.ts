import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { enqueueJob } from "@/lib/jobs/job-store";
import { kickJobWorker } from "@/lib/jobs/job-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Régénère l'aperçu d'un document en arrière-plan (job preview). */
export async function POST(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  const { id } = await params;
  const docId = Number(id);
  if (!Number.isFinite(docId)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  try {
    const job = await enqueueJob("preview", docId, { priority: 40 });
    kickJobWorker();
    return NextResponse.json({ ok: true, status: "queued", jobId: job?.id ?? null });
  } catch (error) {
    return jsonError("Régénération de l'aperçu impossible", error);
  }
}
