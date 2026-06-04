import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/current-user";
import { recordAudit } from "@/lib/audit/audit-store";
import { jsonError } from "@/lib/api-utils";
import { jobStats } from "@/lib/jobs/job-store";
import { runPipelineAction, isPipelineAction } from "@/lib/jobs/pipeline-actions";

/* Pilotage du pipeline : GET = statistiques des jobs ; POST = mise en file de
   lots de retraitement (OCR/IA/miniatures/aperçus/index) ou relance des échecs. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

  if (!isPipelineAction(action)) {
    return jsonError("Action inconnue", `action=${action}`, 400);
  }

  try {
    const result = await runPipelineAction(action);
    await recordAudit({
      action: `pipeline.${action}`,
      details: `${result.queued ?? result.requeued ?? 0} job(s)`,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError("Impossible de planifier le retraitement", error);
  }
}
