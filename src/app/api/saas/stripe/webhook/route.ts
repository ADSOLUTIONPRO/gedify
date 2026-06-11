import { NextResponse, type NextRequest } from "next/server";
import { isStripeEnabled } from "@/lib/saas/stripe/config";
import { handleStripeWebhook } from "@/lib/saas/stripe/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Stripe. Route PUBLIQUE (Stripe n'a pas de session) — sécurisée par la
 * vérification de signature dans handleStripeWebhook (STRIPE_WEBHOOK_SECRET).
 * Doit être listée dans PUBLIC_PREFIXES de src/proxy.ts.
 */
export async function POST(req: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: "Stripe désactivé." }, { status: 503 });
  }
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  const result = await handleStripeWebhook(payload, signature);
  return NextResponse.json({ ok: result.ok, message: result.message }, { status: result.status });
}
