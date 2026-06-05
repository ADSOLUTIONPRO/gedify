import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { computeFinancesReport } from "@/lib/admin/finances-report";

/* Rapport finances (lecture seule). Santé GED. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    return NextResponse.json(await computeFinancesReport());
  } catch (error) {
    return jsonError("Impossible de calculer le rapport finances", error);
  }
}
