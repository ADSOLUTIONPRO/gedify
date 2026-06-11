import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { getTenantById } from "@/lib/tenant/tenant-store";
import { getPlanDefinition, setPlanStripe } from "@/lib/saas/plan-store";
import { recordAudit } from "@/lib/audit/audit-store";
import { getStripeClient, stripeEnvironment } from "./client";
import { getStripeSuccessUrl, getStripeCancelUrl } from "./config";

/* Opérations Stripe (mode test). Toujours via getStripeClient (gated). */

/** Customer Stripe lié au tenant (subscriptions.provider_customer_id), ou null. */
export async function getTenantStripeCustomerId(tenantId: string): Promise<string | null> {
  try {
    const pool = await getPool();
    const { rows } = await pool.query(
      `SELECT provider_customer_id FROM subscriptions
        WHERE tenant_id = $1 AND provider = 'stripe' AND provider_customer_id IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`,
      [tenantId],
    );
    return (rows[0]?.provider_customer_id as string | null) ?? null;
  } catch {
    return null;
  }
}

async function persistCustomerId(tenantId: string, customerId: string): Promise<void> {
  const pool = await getPool();
  const existing = await pool.query(
    "SELECT id FROM subscriptions WHERE tenant_id = $1 AND provider = 'stripe' ORDER BY created_at DESC LIMIT 1",
    [tenantId],
  );
  if (existing.rows[0]) {
    await pool.query("UPDATE subscriptions SET provider_customer_id = $1, updated_at = now() WHERE id = $2", [customerId, existing.rows[0].id]);
  } else {
    await pool.query(
      "INSERT INTO subscriptions(id, tenant_id, plan, status, provider, provider_customer_id) VALUES($1,$2,NULL,'incomplete','stripe',$3)",
      [randomUUID(), tenantId, customerId],
    );
  }
}

/** Crée (ou récupère) le customer Stripe du tenant, avec metadata. */
export async function createOrGetStripeCustomer(tenantId: string): Promise<string> {
  const existing = await getTenantStripeCustomerId(tenantId);
  if (existing) return existing;
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error(`Tenant introuvable : ${tenantId}.`);
  const stripe = await getStripeClient();
  const customer = await stripe.customers.create({
    name: tenant.name ?? tenant.id,
    metadata: { tenant_id: tenant.id, tenant_slug: tenant.slug, environment: stripeEnvironment() },
  });
  await persistCustomerId(tenantId, customer.id);
  await recordAudit({ action: "tenant_updated", target: tenantId, details: `stripe customer ${customer.id}` });
  return customer.id;
}

/** Crée/maj le produit + prices Stripe d'un plan ; n'efface jamais un price existant. */
export async function syncPlanToStripe(planCode: string): Promise<{ productId: string; monthlyPriceId: string | null; yearlyPriceId: string | null }> {
  const def = await getPlanDefinition(planCode);
  const stripe = await getStripeClient();

  let productId = def.stripeProductId;
  if (productId) {
    await stripe.products.update(productId, { name: def.name, description: def.description || undefined });
  } else {
    const product = await stripe.products.create({
      name: def.name,
      description: def.description || undefined,
      metadata: { plan_code: def.code, environment: stripeEnvironment() },
    });
    productId = product.id;
  }

  let monthlyPriceId = def.stripeMonthlyPriceId;
  if (!monthlyPriceId && def.monthlyPriceCents != null) {
    const price = await stripe.prices.create({
      product: productId, currency: (def.currency || "EUR").toLowerCase(),
      unit_amount: def.monthlyPriceCents, recurring: { interval: "month" },
      metadata: { plan_code: def.code, period: "monthly" },
    });
    monthlyPriceId = price.id;
  }
  let yearlyPriceId = def.stripeYearlyPriceId;
  if (!yearlyPriceId && def.yearlyPriceCents != null) {
    const price = await stripe.prices.create({
      product: productId, currency: (def.currency || "EUR").toLowerCase(),
      unit_amount: def.yearlyPriceCents, recurring: { interval: "year" },
      metadata: { plan_code: def.code, period: "yearly" },
    });
    yearlyPriceId = price.id;
  }

  await setPlanStripe(def.code, { productId, monthlyPriceId, yearlyPriceId });
  return { productId, monthlyPriceId, yearlyPriceId };
}

/** Session Stripe Checkout (abonnement). Retourne l'URL de redirection. */
export async function createStripeCheckoutSession(
  tenantId: string,
  planCode: string,
  billingPeriod: "monthly" | "yearly",
): Promise<string> {
  const def = await getPlanDefinition(planCode);
  const priceId = billingPeriod === "yearly" ? def.stripeYearlyPriceId : def.stripeMonthlyPriceId;
  if (!priceId) throw new Error(`Plan « ${planCode} » non synchronisé avec Stripe (price ${billingPeriod} manquant).`);
  const customer = await createOrGetStripeCustomer(tenantId);
  const stripe = await getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: getStripeSuccessUrl(),
    cancel_url: getStripeCancelUrl(),
    metadata: { tenant_id: tenantId, plan_code: def.code, billing_period: billingPeriod, environment: stripeEnvironment() },
    subscription_data: { metadata: { tenant_id: tenantId, plan_code: def.code } },
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de checkout.");
  await recordAudit({ action: "subscription_updated", target: tenantId, details: `checkout ${def.code}/${billingPeriod}` });
  return session.url;
}

/** Session Billing Portal Stripe. Retourne l'URL. */
export async function createStripeBillingPortalSession(tenantId: string): Promise<string> {
  const customer = await getTenantStripeCustomerId(tenantId);
  if (!customer) throw new Error("Aucun client Stripe pour cet espace.");
  const stripe = await getStripeClient();
  const session = await stripe.billingPortal.sessions.create({ customer, return_url: getStripeSuccessUrl() });
  return session.url;
}
