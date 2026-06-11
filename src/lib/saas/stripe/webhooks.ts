import "server-only";

import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { getPool } from "@/lib/db/pg";
import { getTenantById } from "@/lib/tenant/tenant-store";
import { updateTenant } from "@/lib/tenant/tenant-admin";
import { recordAudit } from "@/lib/audit/audit-store";
import { getStripeClient } from "./client";
import { getStripeWebhookSecret } from "./config";

/* ────────────────────────────────────────────────────────────────────────
   Webhooks Stripe (Phase 9). Vérifie la signature, IDÉMPOTENT (provider_event_id),
   ne fait jamais confiance au client : le tenant vient des metadata Stripe OU du
   mapping customer→subscription. Persiste PaymentEvent / Subscription / Invoice.
   ──────────────────────────────────────────────────────────────────────── */

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.created",
  "invoice.finalized",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

async function eventAlreadyProcessed(eventId: string): Promise<boolean> {
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT 1 FROM payment_events WHERE provider_event_id = $1 LIMIT 1", [eventId]);
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function recordEvent(tenantId: string | null, type: string, eventId: string, raw: unknown): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO payment_events(id, tenant_id, provider, event_type, provider_event_id, processed_at, raw)
     VALUES ($1, $2, 'stripe', $3, $4, now(), $5)`,
    [randomUUID(), tenantId, type, eventId, JSON.stringify(raw)],
  );
}

/** Retrouve le tenant : metadata d'abord, sinon mapping customer → subscriptions. */
async function resolveTenantId(meta: Record<string, string> | undefined, customerId: string | null): Promise<string | null> {
  const fromMeta = meta?.tenant_id;
  if (fromMeta && (await getTenantById(fromMeta).catch(() => null))) return fromMeta;
  if (customerId) {
    try {
      const pool = await getPool();
      const { rows } = await pool.query(
        "SELECT tenant_id FROM subscriptions WHERE provider = 'stripe' AND provider_customer_id = $1 ORDER BY created_at DESC LIMIT 1",
        [customerId],
      );
      if (rows[0]?.tenant_id) return String(rows[0].tenant_id);
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function upsertStripeSubscription(tenantId: string, sub: Stripe.Subscription): Promise<void> {
  const pool = await getPool();
  const planCode = (sub.metadata?.plan_code as string | undefined) ?? null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  // Selon la version d'API Stripe, current_period_* est au niveau abonnement ou
  // sur l'item ; lecture tolérante (pas de couplage fort au type SDK).
  const periodRec = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const itemPeriodEnd = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const periodEndTs = periodRec.current_period_end ?? itemPeriodEnd?.current_period_end ?? null;
  const periodStartTs = periodRec.current_period_start ?? null;
  const periodEnd = periodEndTs ? new Date(periodEndTs * 1000) : null;
  const periodStart = periodStartTs ? new Date(periodStartTs * 1000) : null;
  const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000) : null;
  const existing = await pool.query("SELECT id FROM subscriptions WHERE provider_subscription_id = $1 LIMIT 1", [sub.id]);
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE subscriptions SET status=$1, plan=COALESCE($2, plan), provider_customer_id=COALESCE($3, provider_customer_id),
         current_period_start=$4, current_period_end=$5, canceled_at=$6, raw=$7, updated_at=now() WHERE id=$8`,
      [sub.status, planCode, customerId, periodStart, periodEnd, canceledAt, JSON.stringify(sub), existing.rows[0].id],
    );
  } else {
    // Réutilise une ligne stripe « incomplete » (créée à la pose du customer) si présente.
    const incomplete = await pool.query(
      "SELECT id FROM subscriptions WHERE tenant_id=$1 AND provider='stripe' AND provider_subscription_id IS NULL ORDER BY created_at DESC LIMIT 1",
      [tenantId],
    );
    if (incomplete.rows[0]) {
      await pool.query(
        `UPDATE subscriptions SET provider_subscription_id=$1, status=$2, plan=COALESCE($3, plan),
           provider_customer_id=COALESCE($4, provider_customer_id), current_period_start=$5, current_period_end=$6,
           canceled_at=$7, raw=$8, updated_at=now() WHERE id=$9`,
        [sub.id, sub.status, planCode, customerId, periodStart, periodEnd, canceledAt, JSON.stringify(sub), incomplete.rows[0].id],
      );
    } else {
      await pool.query(
        `INSERT INTO subscriptions(id, tenant_id, plan, status, provider, provider_customer_id, provider_subscription_id,
           current_period_start, current_period_end, canceled_at, raw)
         VALUES ($1,$2,$3,$4,'stripe',$5,$6,$7,$8,$9,$10)`,
        [randomUUID(), tenantId, planCode, sub.status, customerId, sub.id, periodStart, periodEnd, canceledAt, JSON.stringify(sub)],
      );
    }
  }
  // Reflète le plan sur le tenant quand l'abonnement est actif (la priorité reste
  // aux gratuités manuelles via entitlements).
  if (planCode && (sub.status === "active" || sub.status === "trialing")) {
    await updateTenant(tenantId, { plan: planCode }).catch(() => {});
  }
}

async function upsertStripeInvoice(tenantId: string, inv: Stripe.Invoice): Promise<void> {
  const pool = await getPool();
  const exists = await pool.query("SELECT id FROM invoices WHERE provider_invoice_id = $1 LIMIT 1", [inv.id]);
  const paidAt = inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : null;
  const dueDate = inv.due_date ? new Date(inv.due_date * 1000) : null;
  if (exists.rows[0]) {
    await pool.query(
      `UPDATE invoices SET status=$1, amount_due=$2, amount_paid=$3, currency=$4, due_date=$5, paid_at=$6,
         hosted_invoice_url=$7, invoice_pdf=$8, raw=$9, updated_at=now() WHERE provider_invoice_id=$10`,
      [inv.status, inv.amount_due, inv.amount_paid, (inv.currency || "eur").toUpperCase(), dueDate, paidAt,
        inv.hosted_invoice_url ?? null, inv.invoice_pdf ?? null, JSON.stringify(inv), inv.id],
    );
  } else {
    await pool.query(
      `INSERT INTO invoices(id, tenant_id, provider, provider_invoice_id, status, amount_due, amount_paid, currency,
         due_date, paid_at, hosted_invoice_url, invoice_pdf, raw)
       VALUES ($1,$2,'stripe',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [randomUUID(), tenantId, inv.id, inv.status, inv.amount_due, inv.amount_paid, (inv.currency || "eur").toUpperCase(),
        dueDate, paidAt, inv.hosted_invoice_url ?? null, inv.invoice_pdf ?? null, JSON.stringify(inv)],
    );
  }
}

export type WebhookResult = { ok: boolean; status: number; message: string };

/** Vérifie la signature et traite l'événement. Idempotent. */
export async function handleStripeWebhook(payload: string, signature: string | null): Promise<WebhookResult> {
  const secret = getStripeWebhookSecret();
  if (!secret) return { ok: false, status: 503, message: "Webhook secret manquant." };
  if (!signature) return { ok: false, status: 400, message: "Signature manquante." };

  const stripe = await getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (e) {
    return { ok: false, status: 400, message: `Signature invalide : ${e instanceof Error ? e.message : "?"}` };
  }

  if (!HANDLED.has(event.type)) return { ok: true, status: 200, message: `Ignoré (${event.type}).` };
  if (await eventAlreadyProcessed(event.id)) return { ok: true, status: 200, message: "Déjà traité." };

  try {
    let tenantId: string | null = null;
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      tenantId = await resolveTenantId(s.metadata ?? undefined, typeof s.customer === "string" ? s.customer : null);
    } else if (event.type.startsWith("customer.subscription.")) {
      const sub = event.data.object as Stripe.Subscription;
      tenantId = await resolveTenantId(sub.metadata ?? undefined, typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null);
      if (tenantId) await upsertStripeSubscription(tenantId, sub);
    } else if (event.type.startsWith("invoice.")) {
      const inv = event.data.object as Stripe.Invoice;
      tenantId = await resolveTenantId(inv.metadata ?? undefined, typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null);
      if (tenantId) await upsertStripeInvoice(tenantId, inv);
    }

    await recordEvent(tenantId, event.type, event.id, event);
    await recordAudit({ action: "subscription_updated", target: tenantId ?? "stripe", details: `webhook ${event.type}` });
    return { ok: true, status: 200, message: "OK" };
  } catch (e) {
    // On NE marque PAS l'événement traité → Stripe rejouera.
    return { ok: false, status: 500, message: e instanceof Error ? e.message : "Erreur de traitement." };
  }
}
