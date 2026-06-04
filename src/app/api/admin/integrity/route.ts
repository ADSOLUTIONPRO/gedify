import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { computeIntegrity, integrityDetails } from "@/lib/admin/integrity";

/* Diagnostic d'intégrité de la GED (lecture seule). Alimente la Santé GED.
   ?details=1 ajoute les ids/fichiers concernés (bornés). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const report = await computeIntegrity();
    if (request.nextUrl.searchParams.get("details") === "1") {
      const details = await integrityDetails();
      return NextResponse.json({ ...report, details });
    }
    return NextResponse.json(report);
  } catch (error) {
    return jsonError("Impossible de calculer l'intégrité de la GED", error);
  }
}
