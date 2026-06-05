import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { computeMailReport } from "@/lib/admin/mail-report";

/* Rapport messagerie (lecture seule, aucun token exposé). Santé GED. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    return NextResponse.json(await computeMailReport());
  } catch (error) {
    return jsonError("Impossible de calculer le rapport messagerie", error);
  }
}
