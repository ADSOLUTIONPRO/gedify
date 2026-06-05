import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { computeAutomationReport } from "@/lib/admin/automation-report";

/* Rapport automatisations & actions groupées (lecture seule). Santé GED. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    return NextResponse.json(await computeAutomationReport());
  } catch (error) {
    return jsonError("Impossible de calculer le rapport d'automatisation", error);
  }
}
