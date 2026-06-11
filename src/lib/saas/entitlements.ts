import "server-only";

import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { getTenantById } from "@/lib/tenant/tenant-store";
import { getTenantSubscription } from "./subscriptions";
import { getActiveGrant, type SubscriptionGrant } from "./grants";
import { getPlanDefinition, type PlanDefinition } from "./plan-store";
import { mergeFeatures, type FeatureKey } from "./features";
import { getSaasSettings, applyGlobalFeatureOverrides } from "./settings";

/* ────────────────────────────────────────────────────────────────────────
   DROITS EFFECTIFS d'un tenant (Phase 8). Source UNIQUE des limites + features
   réellement appliquées. Priorité :
     1. tenant.status = suspended → bloqué (cf. assertTenantCanUseSaas)
     2. gratuité (SubscriptionGrant) active → plan offert
     3. abonnement active/trialing → plan abonnement
     4. tenant.plan
     5. free
   Features = plan ⊕ grant.features_override ⊕ tenant_settings.features_override.
   ──────────────────────────────────────────────────────────────────────── */

export type TenantEntitlements = {
  planCode: string;
  source: "grant" | "subscription" | "tenant" | "free";
  planSource: "db" | "fallback";
  limits: { maxUsers: number | null; maxDocuments: number | null; maxStorageMb: number | null };
  features: Record<FeatureKey, boolean>;
  grant: SubscriptionGrant | null;
  grantEndsAt: string | null;
  plan: PlanDefinition;
};

export class FeatureError extends Error {
  constructor(message: string, readonly featureKey: string) {
    super(message);
    this.name = "FeatureError";
  }
}

async function tenantFeaturesOverride(tenantId: string): Promise<Record<string, unknown> | null> {
  if (!postgresActive()) return null;
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT features_override FROM tenant_settings WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    return (rows[0]?.features_override as Record<string, unknown> | null) ?? null;
  } catch {
    return null;
  }
}

/** Code de plan effectif (grant > abonnement actif > tenant.plan > free). */
export async function getEffectivePlanCode(tenantId: string): Promise<{ code: string; source: TenantEntitlements["source"]; grant: SubscriptionGrant | null }> {
  const grant = await getActiveGrant(tenantId).catch(() => null);
  if (grant) return { code: grant.planCode, source: "grant", grant };
  const sub = await getTenantSubscription(tenantId).catch(() => null);
  if (sub && (sub.status === "active" || sub.status === "trialing") && sub.plan) {
    return { code: sub.plan, source: "subscription", grant: null };
  }
  const tenant = await getTenantById(tenantId).catch(() => null);
  if (tenant?.plan) return { code: tenant.plan, source: "tenant", grant: null };
  return { code: "free", source: "free", grant: null };
}

export async function getTenantEntitlements(tenantId: string): Promise<TenantEntitlements> {
  const { code, source, grant } = await getEffectivePlanCode(tenantId);
  const plan = await getPlanDefinition(code);
  const merged = mergeFeatures(plan.features, grant?.featuresOverride ?? undefined, await tenantFeaturesOverride(tenantId) ?? undefined);
  // Interrupteur GLOBAL (settings) : coupe une fonctionnalité pour TOUS les plans.
  const settings = await getSaasSettings().catch(() => null);
  const features = settings ? applyGlobalFeatureOverrides(merged, settings) : merged;
  return {
    planCode: plan.code,
    source,
    planSource: plan.source,
    limits: { maxUsers: plan.maxUsers, maxDocuments: plan.maxDocuments, maxStorageMb: plan.maxStorageMb },
    features,
    grant,
    grantEndsAt: grant?.endsAt ?? null,
    plan,
  };
}

export async function getEffectivePlan(tenantId: string): Promise<PlanDefinition> {
  return (await getTenantEntitlements(tenantId)).plan;
}

export async function getTenantFeatures(tenantId: string): Promise<Record<FeatureKey, boolean>> {
  return (await getTenantEntitlements(tenantId)).features;
}

export async function isFeatureEnabled(tenantId: string, featureKey: FeatureKey): Promise<boolean> {
  const features = await getTenantFeatures(tenantId);
  return features[featureKey] === true;
}

export async function assertFeatureEnabled(tenantId: string, featureKey: FeatureKey): Promise<void> {
  if (!(await isFeatureEnabled(tenantId, featureKey))) {
    throw new FeatureError("Cette fonctionnalité n'est pas disponible dans votre offre.", featureKey);
  }
}

export type FeatureAccess = Record<FeatureKey, boolean>;
export async function getFeatureAccess(tenantId: string): Promise<FeatureAccess> {
  return getTenantFeatures(tenantId);
}

/** Limites numériques effectives (cf. getTenantEntitlements). */
export async function getEffectiveLimits(tenantId: string): Promise<TenantEntitlements["limits"]> {
  return (await getTenantEntitlements(tenantId)).limits;
}

// Réexports pratiques (les fonctions d'écriture vivent dans grants.ts).
export { applyManualGrant, revokeManualGrant, isGrantActive } from "./grants";
