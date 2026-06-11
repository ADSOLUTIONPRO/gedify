import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { isStripeEnabled } from "@/lib/saas/stripe/config";
import { createStripeCheckoutSession } from "@/lib/saas/stripe/sync";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { getPlanDefinition } from "@/lib/saas/plan-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lance un Checkout Stripe pour le tenant courant (owner connecté). */
export async function POST(req: NextRequest) {
  if (!isStripeEnabled()) return NextResponse.json({ error: "Stripe désactivé." }, { status: 503 });
  try {
    const ctx = await getCurrentTenant(); // tenant de l'owner (jamais du client)
    const form = await req.formData().catch(() => null);
    const planCode = String(form?.get("plan") ?? "").trim();
    const period = String(form?.get("period") ?? "monthly").trim() === "yearly" ? "yearly" : "monthly";
    if (!planCode) return NextResponse.json({ error: "Plan requis." }, { status: 400 });

    const def = await getPlanDefinition(planCode);
    if (!def.isActive || !def.isPublic) {
      return NextResponse.json({ error: "Offre indisponible." }, { status: 403 });
    }
    const url = await createStripeCheckoutSession(ctx.tenantId, planCode, period);
    return NextResponse.redirect(url, 303);
  } catch (e) {
    return jsonError("Impossible de démarrer le paiement", e, 400);
  }
}
