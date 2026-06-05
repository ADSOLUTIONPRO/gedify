import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/current-user";
import { jsonError } from "@/lib/api-utils";
import { computeSecurityReport } from "@/lib/admin/security-report";

/* Rapport de sécurité (lecture seule, secrets masqués). Réservé à l'admin.
   Alimente la carte Sécurité de la Santé GED. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const deny = await requirePermission(request, "admin.access");
  if (deny) return deny;
  try {
    return NextResponse.json(await computeSecurityReport());
  } catch (error) {
    return jsonError("Impossible de calculer le rapport de sécurité", error);
  }
}
