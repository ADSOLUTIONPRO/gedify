import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";
import { getTenantById, listTenants } from "@/lib/tenant/tenant-store";
import { updateTenant } from "@/lib/tenant/tenant-admin";

/* ────────────────────────────────────────────────────────────────────────
   Couche ABONNEMENTS interne (Phase 8). Postgres uniquement. Aucun appel
   Stripe. Les actions d'écriture sont déclenchées par des server actions
   superuser. tenant.status (suspended) prime sur l'état commercial.
   ──────────────────────────────────────────────────────────────────────── */

export const SUBSCRIPTION_STATUSES = [
  "trialing", "active", "past_due", "canceled", "unpaid", "paused", "incomplete",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Statuts qui bloquent l'accès métier (en plus de tenant.status=suspended). */
const BLOCKING_STATUSES = new Set<string>(["canceled", "unpaid", "paused"]);
/** Statuts considérés « actifs » (accès autorisé). */
const ACTIVE_STATUSES = new Set<string>(["trialing", "active", "past_due"]);

export type Subscription = {
  id: string;
  tenantId: string;
  plan: string | null;
  status: string | null;
  provider: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  manualGrantId: string | null;
  freeUntil: string | null;
  isFreeForever: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Invoice = {
  id: string; tenantId: string; subscriptionId: string | null; provider: string;
  status: string | null; amountDue: number | null; amountPaid: number | null;
  currency: string | null; dueDate: string | null; paidAt: string | null;
  hostedInvoiceUrl: string | null; createdAt: string | null;
};

export type PaymentEvent = {
  id: string; tenantId: string | null; provider: string; eventType: string | null;
  providerEventId: string | null; processedAt: string | null; createdAt: string | null;
};

export class SubscriptionError extends Error {
  constructor(message: string, readonly code: "suspended" | "blocked" = "blocked") {
    super(message);
    this.name = "SubscriptionError";
  }
}

function assertPostgres() {
  if (!postgresActive()) throw new Error("Postgres requis (abonnements SaaS).");
}
function iso(v: unknown): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}
function rowToSub(r: Record<string, unknown>): Subscription {
  return {
    id: String(r.id), tenantId: String(r.tenant_id), plan: (r.plan as string) ?? null,
    status: (r.status as string) ?? null, provider: String(r.provider ?? "manual"),
    currentPeriodStart: iso(r.current_period_start), currentPeriodEnd: iso(r.current_period_end),
    trialStart: iso(r.trial_start), trialEnd: iso(r.trial_end),
    cancelAt: iso(r.cancel_at), canceledAt: iso(r.canceled_at),
    manualGrantId: (r.manual_grant_id as string) ?? null,
    freeUntil: iso(r.free_until), isFreeForever: r.is_free_forever === true,
    createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
  };
}

export async function getTenantSubscription(tenantId: string): Promise<Subscription | null> {
  assertPostgres();
  const pool = await getPool();
  try {
    const { rows } = await pool.query(
      "SELECT * FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1",
      [tenantId],
    );
    return rows.length ? rowToSub(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function listSubscriptions(): Promise<Subscription[]> {
  assertPostgres();
  const pool = await getPool();
  try {
    const { rows } = await pool.query("SELECT * FROM subscriptions ORDER BY created_at DESC");
    return rows.map(rowToSub);
  } catch {
    return [];
  }
}

export async function createManualSubscription(
  tenantId: string,
  plan: string,
  status: string,
): Promise<Subscription> {
  assertPostgres();
  if (!(SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Statut d'abonnement invalide : ${status}.`);
  }
  const pool = await getPool();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO subscriptions(id, tenant_id, plan, status, provider) VALUES($1, $2, $3, $4, 'manual')`,
    [id, tenantId, plan, status],
  );
  await recordAudit({ action: "subscription_created", target: tenantId, details: `plan=${plan} status=${status} provider=manual` });
  const sub = await getTenantSubscription(tenantId);
  return sub!;
}

export async function updateSubscriptionStatus(tenantId: string, status: string): Promise<void> {
  assertPostgres();
  if (!(SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Statut d'abonnement invalide : ${status}.`);
  }
  const sub = await getTenantSubscription(tenantId);
  if (!sub) {
    await createManualSubscription(tenantId, "free", status);
    return;
  }
  const pool = await getPool();
  await pool.query("UPDATE subscriptions SET status = $1, updated_at = now() WHERE id = $2", [status, sub.id]);
  await recordAudit({ action: "subscription_updated", target: tenantId, details: `status=${status}` });
}

export async function changeTenantPlan(tenantId: string, plan: string): Promise<void> {
  assertPostgres();
  const sub = await getTenantSubscription(tenantId);
  if (sub) {
    const pool = await getPool();
    await pool.query("UPDATE subscriptions SET plan = $1, updated_at = now() WHERE id = $2", [plan, sub.id]);
  }
  await updateTenant(tenantId, { plan });
  await recordAudit({ action: "tenant_effective_plan_changed", target: tenantId, details: `plan=${plan}` });
}

export async function cancelSubscription(tenantId: string): Promise<void> {
  assertPostgres();
  const sub = await getTenantSubscription(tenantId);
  if (!sub) return;
  const pool = await getPool();
  await pool.query(
    "UPDATE subscriptions SET status = 'canceled', canceled_at = now(), updated_at = now() WHERE id = $1",
    [sub.id],
  );
  await recordAudit({ action: "subscription_updated", target: tenantId, details: "status=canceled" });
}

export async function resumeSubscription(tenantId: string): Promise<void> {
  assertPostgres();
  const sub = await getTenantSubscription(tenantId);
  if (!sub) return;
  const pool = await getPool();
  await pool.query(
    "UPDATE subscriptions SET status = 'active', canceled_at = NULL, cancel_at = NULL, updated_at = now() WHERE id = $1",
    [sub.id],
  );
  await recordAudit({ action: "subscription_updated", target: tenantId, details: "status=active (resume)" });
}

export async function isTenantSubscriptionActive(tenantId: string): Promise<boolean> {
  const sub = await getTenantSubscription(tenantId).catch(() => null);
  if (!sub) return true; // pas d'abonnement → on n'enferme pas (alerte ailleurs)
  return ACTIVE_STATUSES.has(sub.status ?? "");
}

/**
 * Accès SaaS métier : lève SubscriptionError si tenant suspendu OU abonnement
 * dans un statut bloquant (canceled/unpaid/paused). No-op hors postgres.
 */
export async function assertTenantCanUseSaas(tenantId: string): Promise<void> {
  if (!postgresActive()) return;
  const tenant = await getTenantById(tenantId).catch(() => null);
  if (tenant && (tenant.status ?? "").toLowerCase() === "suspended") {
    throw new SubscriptionError("Espace suspendu — contactez l'administrateur.", "suspended");
  }
  const sub = await getTenantSubscription(tenantId).catch(() => null);
  if (sub && BLOCKING_STATUSES.has(sub.status ?? "")) {
    throw new SubscriptionError(`Abonnement ${sub.status} — accès limité.`, "blocked");
  }
}

export async function getTenantInvoices(tenantId: string): Promise<Invoice[]> {
  assertPostgres();
  const pool = await getPool();
  try {
    const { rows } = await pool.query("SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
    return rows.map((r) => ({
      id: String(r.id), tenantId: String(r.tenant_id), subscriptionId: (r.subscription_id as string) ?? null,
      provider: String(r.provider ?? "manual"), status: (r.status as string) ?? null,
      amountDue: r.amount_due == null ? null : Number(r.amount_due), amountPaid: r.amount_paid == null ? null : Number(r.amount_paid),
      currency: (r.currency as string) ?? "EUR", dueDate: iso(r.due_date), paidAt: iso(r.paid_at),
      hostedInvoiceUrl: (r.hosted_invoice_url as string) ?? null, createdAt: iso(r.created_at),
    }));
  } catch {
    return [];
  }
}

export async function listInvoices(): Promise<Invoice[]> {
  assertPostgres();
  const pool = await getPool();
  try {
    const { rows } = await pool.query("SELECT * FROM invoices ORDER BY created_at DESC LIMIT 500");
    return rows.map((r) => ({
      id: String(r.id), tenantId: String(r.tenant_id), subscriptionId: (r.subscription_id as string) ?? null,
      provider: String(r.provider ?? "manual"), status: (r.status as string) ?? null,
      amountDue: r.amount_due == null ? null : Number(r.amount_due), amountPaid: r.amount_paid == null ? null : Number(r.amount_paid),
      currency: (r.currency as string) ?? "EUR", dueDate: iso(r.due_date), paidAt: iso(r.paid_at),
      hostedInvoiceUrl: (r.hosted_invoice_url as string) ?? null, createdAt: iso(r.created_at),
    }));
  } catch {
    return [];
  }
}

export async function listPaymentEvents(tenantId: string): Promise<PaymentEvent[]> {
  assertPostgres();
  const pool = await getPool();
  try {
    const { rows } = await pool.query("SELECT * FROM payment_events WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50", [tenantId]);
    return rows.map((r) => ({
      id: String(r.id), tenantId: (r.tenant_id as string) ?? null, provider: String(r.provider ?? "manual"),
      eventType: (r.event_type as string) ?? null, providerEventId: (r.provider_event_id as string) ?? null,
      processedAt: iso(r.processed_at), createdAt: iso(r.created_at),
    }));
  } catch {
    return [];
  }
}

export type SubscriptionAlerts = {
  noSubscription: { id: string; name: string | null }[];
  pastDue: { id: string; name: string | null }[];
  suspended: { id: string; name: string | null }[];
  trialExpiringSoon: { id: string; name: string | null; trialEnd: string | null }[];
};

/** Alertes commerciales pour le tableau de bord SaaS. */
export async function getSubscriptionAlerts(): Promise<SubscriptionAlerts> {
  const tenants = await listTenants().catch(() => []);
  const subs = await listSubscriptions().catch(() => []);
  const latestByTenant = new Map<string, Subscription>();
  for (const s of subs) if (!latestByTenant.has(s.tenantId)) latestByTenant.set(s.tenantId, s);

  const noSubscription: SubscriptionAlerts["noSubscription"] = [];
  const pastDue: SubscriptionAlerts["pastDue"] = [];
  const suspended: SubscriptionAlerts["suspended"] = [];
  const trialExpiringSoon: SubscriptionAlerts["trialExpiringSoon"] = [];
  const soon = Date.now() + 7 * 24 * 3600 * 1000;

  for (const t of tenants) {
    const label = { id: t.id, name: t.name };
    if ((t.status ?? "").toLowerCase() === "suspended") suspended.push(label);
    const sub = latestByTenant.get(t.id);
    if (!sub) {
      noSubscription.push(label);
      continue;
    }
    if (sub.status === "past_due") pastDue.push(label);
    if (sub.status === "trialing" && sub.trialEnd) {
      const end = new Date(sub.trialEnd).getTime();
      if (Number.isFinite(end) && end <= soon) trialExpiringSoon.push({ ...label, trialEnd: sub.trialEnd });
    }
  }
  return { noSubscription, pastDue, suspended, trialExpiringSoon };
}
