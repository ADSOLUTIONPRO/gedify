import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";

/* ────────────────────────────────────────────────────────────────────────
   Gratuités / offres manuelles (table subscription_grants). Permet au superuser
   d'offrir un plan payant gratuitement (X jours/mois/ans ou à vie).
   ──────────────────────────────────────────────────────────────────────── */

export type GrantDurationUnit = "day" | "month" | "year" | "lifetime";
export type GrantType = "free_trial" | "free_period" | "free_forever" | "manual_discount" | "internal";

export type SubscriptionGrant = {
  id: string;
  tenantId: string;
  planCode: string;
  grantType: GrantType | string;
  startsAt: string | null;
  endsAt: string | null;
  durationCount: number | null;
  durationUnit: string | null;
  reason: string | null;
  grantedByUserId: number | null;
  isActive: boolean;
  featuresOverride: Record<string, unknown> | null;
  createdAt: string | null;
};

function iso(v: unknown): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}
function rowToGrant(r: Record<string, unknown>): SubscriptionGrant {
  return {
    id: String(r.id), tenantId: String(r.tenant_id), planCode: String(r.plan_code),
    grantType: String(r.grant_type), startsAt: iso(r.starts_at), endsAt: iso(r.ends_at),
    durationCount: r.duration_count == null ? null : Number(r.duration_count),
    durationUnit: (r.duration_unit as string) ?? null, reason: (r.reason as string) ?? null,
    grantedByUserId: r.granted_by_user_id == null ? null : Number(r.granted_by_user_id),
    isActive: r.is_active !== false, featuresOverride: (r.features_override as Record<string, unknown>) ?? null,
    createdAt: iso(r.created_at),
  };
}

/** Une gratuité est-elle active à l'instant T ? (à vie = ends_at null) */
export function isGrantActive(g: SubscriptionGrant, now = Date.now()): boolean {
  if (!g.isActive) return false;
  if (g.startsAt && new Date(g.startsAt).getTime() > now) return false;
  if (g.endsAt && new Date(g.endsAt).getTime() <= now) return false;
  return true;
}

function computeEndsAt(count: number | null, unit: GrantDurationUnit): Date | null {
  if (unit === "lifetime") return null;
  const n = count ?? 0;
  const d = new Date();
  if (unit === "day") d.setDate(d.getDate() + n);
  else if (unit === "month") d.setMonth(d.getMonth() + n);
  else if (unit === "year") d.setFullYear(d.getFullYear() + n);
  return d;
}

export async function getActiveGrant(tenantId: string): Promise<SubscriptionGrant | null> {
  if (!postgresActive()) return null;
  try {
    const pool = await getPool();
    const { rows } = await pool.query(
      "SELECT * FROM subscription_grants WHERE tenant_id = $1 AND is_active = true ORDER BY created_at DESC",
      [tenantId],
    );
    for (const r of rows) {
      const g = rowToGrant(r);
      if (isGrantActive(g)) return g;
    }
    return null;
  } catch {
    return null;
  }
}

export async function listGrants(): Promise<SubscriptionGrant[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM subscription_grants ORDER BY created_at DESC");
    return rows.map(rowToGrant);
  } catch {
    return [];
  }
}

export async function listTenantGrants(tenantId: string): Promise<SubscriptionGrant[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM subscription_grants WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId]);
    return rows.map(rowToGrant);
  } catch {
    return [];
  }
}

export type ApplyGrantInput = {
  planCode: string;
  durationCount: number | null;
  durationUnit: GrantDurationUnit;
  reason?: string | null;
  grantedByUserId?: number | null;
  featuresOverride?: Record<string, boolean> | null;
};

/** Offre un plan gratuitement. Désactive les gratuités précédentes du tenant. */
export async function applyManualGrant(tenantId: string, input: ApplyGrantInput): Promise<SubscriptionGrant> {
  if (!postgresActive()) throw new Error("Postgres requis pour les gratuités.");
  const pool = await getPool();
  const endsAt = computeEndsAt(input.durationCount, input.durationUnit);
  const grantType: GrantType = input.durationUnit === "lifetime" ? "free_forever" : "free_period";
  const id = randomUUID();
  // On ne garde qu'une gratuité active à la fois (la nouvelle).
  await pool.query("UPDATE subscription_grants SET is_active = false, updated_at = now() WHERE tenant_id = $1 AND is_active = true", [tenantId]);
  await pool.query(
    `INSERT INTO subscription_grants
       (id, tenant_id, plan_code, grant_type, starts_at, ends_at, duration_count, duration_unit, reason, granted_by_user_id, is_active, features_override)
     VALUES ($1,$2,$3,$4, now(), $5, $6, $7, $8, $9, true, $10)`,
    [
      id, tenantId, input.planCode.trim().toLowerCase(), grantType, endsAt, input.durationCount ?? null,
      input.durationUnit, input.reason ?? null, input.grantedByUserId ?? null,
      input.featuresOverride ? JSON.stringify(input.featuresOverride) : null,
    ],
  );
  await recordAudit({
    action: "subscription_grant_created",
    target: tenantId,
    details: `plan=${input.planCode} ${input.durationUnit === "lifetime" ? "à vie" : `${input.durationCount} ${input.durationUnit}`}${input.reason ? ` reason=${input.reason}` : ""}`,
  });
  await recordAudit({ action: "tenant_effective_plan_changed", target: tenantId, details: `grant→${input.planCode}` });
  const { rows } = await pool.query("SELECT * FROM subscription_grants WHERE id = $1", [id]);
  return rowToGrant(rows[0]);
}

export async function revokeManualGrant(grantId: string): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  const { rows } = await pool.query("SELECT tenant_id FROM subscription_grants WHERE id = $1", [grantId]);
  await pool.query("UPDATE subscription_grants SET is_active = false, updated_at = now() WHERE id = $1", [grantId]);
  const tenantId = rows[0]?.tenant_id ? String(rows[0].tenant_id) : grantId;
  await recordAudit({ action: "subscription_grant_revoked", target: tenantId, details: `grant=${grantId}` });
  await recordAudit({ action: "tenant_effective_plan_changed", target: tenantId, details: "grant révoqué" });
}
