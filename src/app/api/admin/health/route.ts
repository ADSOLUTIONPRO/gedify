import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { computeGedHealth } from "@/lib/admin/health";

/* État de santé de la GED (lecture seule). Alimente la page Administration › Santé. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const health = await computeGedHealth();
    return NextResponse.json(health);
  } catch (error) {
    return jsonError("Impossible de calculer l'état de santé de la GED", error);
  }
}
