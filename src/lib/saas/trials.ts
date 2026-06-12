import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";
import { getTenantById, listTenantMembersWithUser } from "@/lib/tenant/tenant-store";
import { getTenantSubscription } from "@/lib/saas/subscriptions";
import { getTrialPolicy } from "@/lib/saas/settings";
import { enqueueMail } from "@/lib/saas/mailing/queue";
import { getAppBaseUrl } from "@/lib/saas/mailing/config";

/* Périodes d'essai = abonnement manuel status='trialing' avec trial_start/end.
   S'appuie sur le service subscriptions (pas de table dédiée → pas de doublon).
   Le plan effectif d'un essai est déjà résolu par entitlements (status trialing). */

export type TrialState = "none" | "active" | "ending_soon" | "expired" | "converted" | "canceled";

export type TrialStatus = {
  state: TrialState;
  planCode: string | null;
  trialEnd: string | null;
  daysLeft: number | null;
};

function daysBetween(target: Date): number {
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

export async function getTrialStatus(tenantId: string): Promise<TrialStatus> {
  const sub = await getTenantSubscription(tenantId).catch(() => null);
  if (!sub || !sub.trialEnd) return { state: "none", planCode: sub?.plan ?? null, trialEnd: null, daysLeft: null };
  const end = new Date(sub.trialEnd);
  const daysLeft = daysBetween(end);
  let state: TrialState = "active";
  if (sub.status === "canceled") state = "canceled";
  else if (sub.status === "active") state = "converted";
  else if (sub.status !== "trialing") state = "expired";
  else if (daysLeft <= 0) state = "expired";
  else if (daysLeft <= 3) state = "ending_soon";
  return { state, planCode: sub.plan ?? null, trialEnd: end.toISOString(), daysLeft };
}

export type TrialRow = { tenantId: string; tenantName: string | null; plan: string | null; status: string; trialStart: string | null; trialEnd: string | null; daysLeft: number | null; state: TrialState };

export async function listTrials(): Promise<TrialRow[]> {
  if (!postgresActive()) return [];
  const pool = await getPool();
  const { rows } = await pool.query(
    "SELECT s.tenant_id, s.plan, s.status, s.trial_start, s.trial_end, t.name FROM subscriptions s LEFT JOIN tenants t ON t.id=s.tenant_id WHERE s.trial_end IS NOT NULL ORDER BY s.trial_end ASC",
  );
  return rows.map((r) => {
    const end = r.trial_end ? new Date(String(r.trial_end)) : null;
    const daysLeft = end ? daysBetween(end) : null;
    const status = String(r.status ?? "");
    let state: TrialState = "active";
    if (status === "canceled") state = "canceled";
    else if (status === "active") state = "converted";
    else if (status !== "trialing") state = "expired";
    else if (daysLeft != null && daysLeft <= 0) state = "expired";
    else if (daysLeft != null && daysLeft <= 3) state = "ending_soon";
    return { tenantId: String(r.tenant_id), tenantName: (r.name as string) ?? null, plan: (r.plan as string) ?? null, status, trialStart: r.trial_start ? new Date(String(r.trial_start)).toISOString() : null, trialEnd: end?.toISOString() ?? null, daysLeft, state };
  });
}

async function upsertTrialRow(tenantId: string, plan: string, trialStart: Date, trialEnd: Date): Promise<void> {
  const pool = await getPool();
  const existing = await getTenantSubscription(tenantId).catch(() => null);
  if (existing) {
    await pool.query("UPDATE subscriptions SET plan=$2, status='trialing', trial_start=$3, trial_end=$4, canceled_at=NULL, updated_at=now() WHERE tenant_id=$1", [tenantId, plan, trialStart, trialEnd]);
  } else {
    await pool.query("INSERT INTO subscriptions(id, tenant_id, plan, status, provider, trial_start, trial_end) VALUES ($1,$2,$3,'trialing','manual',$4,$5)", [randomUUID(), tenantId, plan, trialStart, trialEnd]);
  }
}

export async function createTrial(tenantId: string, planCode: string, durationDays: number, actor?: string): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const start = new Date();
  const end = new Date(start.getTime() + durationDays * 86_400_000);
  await upsertTrialRow(tenantId, planCode, start, end);
  await recordAudit({ action: "trial_created", target: tenantId, details: `plan=${planCode} jours=${durationDays}`, user: actor });
  await notifyTrial(tenantId, "subscription.trial_started", { planName: planCode, trialEnd: end.toLocaleDateString("fr-FR") });
  try {
    const { logTenantSecurityEvent } = await import("@/lib/saas/security/security-events");
    await logTenantSecurityEvent(tenantId, "trial_created", `Essai ${planCode} (${durationDays} j)`, { category: "billing" });
  } catch { /* best-effort */ }
}

export async function extendTrial(tenantId: string, days: number, actor?: string): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const sub = await getTenantSubscription(tenantId);
  if (!sub?.trialEnd) throw new Error("Aucun essai en cours pour ce tenant.");
  const base = new Date(sub.trialEnd);
  const newEnd = new Date(Math.max(base.getTime(), Date.now()) + days * 86_400_000);
  const pool = await getPool();
  await pool.query("UPDATE subscriptions SET trial_end=$2, status='trialing', updated_at=now() WHERE tenant_id=$1", [tenantId, newEnd]);
  await recordAudit({ action: "trial_extended", target: tenantId, details: `+${days} j`, user: actor });
  await notifyTrial(tenantId, "subscription.trial_started", { planName: sub.plan ?? "", trialEnd: newEnd.toLocaleDateString("fr-FR") });
}

export async function cancelTrial(tenantId: string, actor?: string): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  await pool.query("UPDATE subscriptions SET status='canceled', canceled_at=now(), updated_at=now() WHERE tenant_id=$1", [tenantId]);
  await recordAudit({ action: "trial_canceled", target: tenantId, user: actor });
}

export async function convertTrialToSubscription(tenantId: string, planCode: string, actor?: string): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  await pool.query("UPDATE subscriptions SET plan=$2, status='active', updated_at=now() WHERE tenant_id=$1", [tenantId, planCode]);
  // Aligne le plan du tenant.
  await pool.query("UPDATE tenants SET plan=$2, updated_at=now() WHERE id=$1", [tenantId, planCode]).catch(() => {});
  await recordAudit({ action: "trial_converted", target: tenantId, details: `plan=${planCode}`, user: actor });
  await notifyTrial(tenantId, "subscription.activated", { planName: planCode, nextBillingDate: "—" });
}

export async function expireTrial(tenantId: string, actor?: string): Promise<void> {
  if (!postgresActive()) return;
  const policy = await getTrialPolicy();
  const pool = await getPool();
  // Statut d'essai expiré → canceled (entitlements retombe sur tenant.plan / free).
  await pool.query("UPDATE subscriptions SET status='canceled', canceled_at=now(), updated_at=now() WHERE tenant_id=$1 AND status='trialing'", [tenantId]);
  if (policy.restrictPremiumAfter) {
    await pool.query("UPDATE tenants SET plan=$2, updated_at=now() WHERE id=$1", [tenantId, policy.fallbackPlan]).catch(() => {});
  }
  await recordAudit({ action: "trial_expired", target: tenantId, user: actor });
  await notifyTrial(tenantId, "subscription.trial_ending", { pricingUrl: `${getAppBaseUrl()}/pricing` });
  try {
    const { logTenantSecurityEvent } = await import("@/lib/saas/security/security-events");
    await logTenantSecurityEvent(tenantId, "trial_expiration_restrictions_applied", "Essai expiré, restrictions appliquées", { category: "billing", severity: "warning" });
  } catch { /* best-effort */ }
}

async function tenantContact(tenantId: string): Promise<{ email: string; name: string | null } | null> {
  try {
    const members = await listTenantMembersWithUser(tenantId);
    const m = members.find((x) => x.role === "owner" && x.email) ?? members.find((x) => x.email);
    return m?.email ? { email: m.email, name: m.username } : null;
  } catch { return null; }
}

async function notifyTrial(tenantId: string, templateKey: string, vars: Record<string, string>, dedupeKey?: string): Promise<void> {
  try {
    const contact = await tenantContact(tenantId);
    if (!contact) return;
    const tenant = await getTenantById(tenantId).catch(() => null);
    await enqueueMail({
      to: contact.email, toName: contact.name, templateKey, category: "subscription", tenantId, dedupeKey,
      vars: { recipientName: contact.name ?? "", tenantName: tenant?.name ?? tenantId, pricingUrl: `${getAppBaseUrl()}/pricing`, ...vars },
    });
  } catch { /* best-effort */ }
}

/** Relances d'essai + expiration automatique (cron). */
export async function runTrialReminders(): Promise<{ reminders: number; expired: number }> {
  const out = { reminders: 0, expired: 0 };
  if (!postgresActive()) return out;
  const policy = await getTrialPolicy();
  const trials = (await listTrials()).filter((t) => t.status === "trialing");
  for (const t of trials) {
    if (t.daysLeft == null || !t.trialEnd) continue;
    const endStr = t.trialEnd.slice(0, 10);
    if (t.daysLeft <= 0) {
      await expireTrial(t.tenantId);
      out.expired++;
      continue;
    }
    const want = (lvl: number, on: boolean) => on && t.daysLeft === lvl;
    let level: number | null = null;
    if (want(7, policy.reminder7d)) level = 7;
    else if (want(3, policy.reminder3d)) level = 3;
    else if (want(1, policy.reminder1d)) level = 1;
    if (level != null) {
      await notifyTrial(t.tenantId, "subscription.trial_ending",
        { planName: t.plan ?? "", trialEnd: new Date(t.trialEnd).toLocaleDateString("fr-FR"), pricingUrl: `${getAppBaseUrl()}/pricing` },
        `trial:${t.tenantId}:${level}:${endStr}`);
      out.reminders++;
    }
  }
  return out;
}
