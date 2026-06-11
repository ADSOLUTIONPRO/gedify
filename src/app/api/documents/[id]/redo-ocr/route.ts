import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { enqueueJob } from "@/lib/jobs/job-store";
import { kickJobWorker } from "@/lib/jobs/job-worker";
import { featureGate } from "@/lib/saas/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Relance RÉELLE de l'OCR d'un document : met un job `ocr` en file (le worker
 * pipeline ré-extrait le texte et réindexe en arrière-plan). Remplace l'ancien
 * appel bulk_edit `redo_ocr` qui n'était pas traité par le moteur.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  const denied = await featureGate("ocr");
  if (denied) return denied;

  const { id } = await params;
  const docId = Number(id);
  if (!Number.isFinite(docId)) {
    return NextResponse.json({ error: "Identifiant de document invalide." }, { status: 400 });
  }

  try {
    const job = await enqueueJob("ocr", docId, { priority: 50 });
    kickJobWorker();
    return NextResponse.json({
      ok: true,
      status: "queued",
      jobId: job?.id ?? null,
      message: "OCR relancé en arrière-plan — le texte et l'index seront mis à jour sous peu.",
    });
  } catch (error) {
    return jsonError("Relance de l'OCR impossible", error);
  }
}
