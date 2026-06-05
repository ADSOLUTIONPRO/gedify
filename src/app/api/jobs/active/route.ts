import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { listJobs } from "@/lib/jobs/job-store";

/* Activité de traitement en cours (import → OCR/IA/miniatures/index/aperçus).
   Lecture seule : alimente l'indicateur global non bloquant. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const jobs = await listJobs();
    const active = jobs.filter((j) => j.status === "pending" || j.status === "processing");
    const byType: Record<string, number> = {};
    for (const j of active) byType[j.type] = (byType[j.type] ?? 0) + 1;
    return NextResponse.json({
      total: active.length,
      pending: active.filter((j) => j.status === "pending").length,
      processing: active.filter((j) => j.status === "processing").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      byType,
    });
  } catch (error) {
    return jsonError("Impossible de lister les jobs actifs", error);
  }
}
