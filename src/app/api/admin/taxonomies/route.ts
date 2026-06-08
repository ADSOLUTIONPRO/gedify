import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { auditTaxonomies, repairTaxonomies } from "@/lib/taxonomies/repair-orphans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/taxonomies — diagnostic (compteurs + valeurs orphelines). */
export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    return NextResponse.json(await auditTaxonomies());
  } catch (error) {
    return jsonError("Diagnostic des taxonomies impossible.", error);
  }
}

/** POST /api/admin/taxonomies — répare les taxonomies orphelines (idempotent). */
export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const report = await repairTaxonomies();
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return jsonError("Réparation des taxonomies impossible.", error);
  }
}
