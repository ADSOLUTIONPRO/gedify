import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { isStripeEnabled } from "@/lib/saas/stripe/config";
import { createStripeBillingPortalSession } from "@/lib/saas/stripe/sync";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ouvre le Billing Portal Stripe du tenant courant (owner connecté). */
export async function POST(_req: NextRequest) {
  if (!isStripeEnabled()) return NextResponse.json({ error: "Stripe désactivé." }, { status: 503 });
  try {
    const ctx = await getCurrentTenant();
    const url = await createStripeBillingPortalSession(ctx.tenantId);
    return NextResponse.redirect(url, 303);
  } catch (e) {
    return jsonError("Impossible d'ouvrir le portail de facturation", e, 400);
  }
}
