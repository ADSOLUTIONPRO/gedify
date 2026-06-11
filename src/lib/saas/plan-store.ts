import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";
import { PLAN_IDS, PLANS, getPlan } from "./plans";
import { getPlanFeatures, mergeFeatures, type FeatureKey } from "./features";

/* ────────────────────────────────────────────────────────────────────────
   Plans administrables (table saas_plans) avec FALLBACK sur src/lib/saas/plans.ts
   quand la table est vide ou que le code n'y est pas. Source unique des
   définitions de plan (limites + features) pour entitlements.
   ──────────────────────────────────────────────────────────────────────── */

export type PlanDefinition = {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  isPublic: boolean;
  isDefault: boolean;
  sortOrder: number;
  monthlyPriceCents: number | null;
  yearlyPriceCents: number | null;
  currency: string;
  maxUsers: number | null;
  maxDocuments: number | null;
  maxStorageMb: number | null;
  supportLevel: string | null;
  features: Record<FeatureKey, boolean>;
  stripeProductId: string | null;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  /** "db" si la définition vient de la table, "fallback" si de plans.ts. */
  source: "db" | "fallback";
};

function fallbackDefinition(code: string): PlanDefinition {
  const p = getPlan(code);
  return {
    code: p.id, name: p.label, description: p.description, isActive: true,
    isPublic: code !== "internal", isDefault: code === "free", sortOrder: PLAN_IDS.indexOf(p.id),
    monthlyPriceCents: null, yearlyPriceCents: null, currency: "EUR",
    maxUsers: p.maxUsers, maxDocuments: p.maxDocuments, maxStorageMb: p.maxStorageMb,
    supportLevel: p.supportLevel, features: getPlanFeatures(p.id),
    stripeProductId: null, stripeMonthlyPriceId: null, stripeYearlyPriceId: null, source: "fallback",
  };
}

function rowToDefinition(r: Record<string, unknown>): PlanDefinition {
  const code = String(r.code);
  const base = getPlanFeatures(code);
  const features = mergeFeatures(base, (r.features as Record<string, unknown> | null) ?? undefined);
  return {
    code,
    name: (r.name as string) ?? code,
    description: (r.description as string) ?? "",
    isActive: r.is_active !== false,
    isPublic: r.is_public === true,
    isDefault: r.is_default === true,
    sortOrder: Number(r.sort_order ?? 0),
    monthlyPriceCents: r.monthly_price_cents == null ? null : Number(r.monthly_price_cents),
    yearlyPriceCents: r.yearly_price_cents == null ? null : Number(r.yearly_price_cents),
    currency: (r.currency as string) ?? "EUR",
    maxUsers: r.max_users == null ? null : Number(r.max_users),
    maxDocuments: r.max_documents == null ? null : Number(r.max_documents),
    maxStorageMb: r.max_storage_mb == null ? null : Number(r.max_storage_mb),
    supportLevel: (r.support_level as string) ?? null,
    features,
    stripeProductId: (r.stripe_product_id as string) ?? null,
    stripeMonthlyPriceId: (r.stripe_monthly_price_id as string) ?? null,
    stripeYearlyPriceId: (r.stripe_yearly_price_id as string) ?? null,
    source: "db",
  };
}

/** Définition d'un plan : table saas_plans (actif) sinon fallback plans.ts. */
export async function getPlanDefinition(code: string): Promise<PlanDefinition> {
  const c = (code ?? "").trim().toLowerCase();
  if (postgresActive()) {
    try {
      const pool = await getPool();
      const { rows } = await pool.query("SELECT * FROM saas_plans WHERE code = $1 LIMIT 1", [c]);
      if (rows.length) return rowToDefinition(rows[0]);
    } catch {
      /* table absente → fallback */
    }
  }
  return fallbackDefinition(c);
}

/** Tous les plans : table si non vide, sinon les plans par défaut (plans.ts). */
export async function listPlanDefinitions(): Promise<PlanDefinition[]> {
  if (postgresActive()) {
    try {
      const pool = await getPool();
      const { rows } = await pool.query("SELECT * FROM saas_plans ORDER BY sort_order, code");
      if (rows.length) return rows.map(rowToDefinition);
    } catch {
      /* table absente */
    }
  }
  return PLAN_IDS.map((id) => fallbackDefinition(id));
}

export type UpsertPlanInput = {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  isPublic?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  monthlyPriceCents?: number | null;
  yearlyPriceCents?: number | null;
  currency?: string;
  maxUsers?: number | null;
  maxDocuments?: number | null;
  maxStorageMb?: number | null;
  supportLevel?: string | null;
  features?: Record<string, boolean>;
};

const PLAN_CODE_RE = /^[a-z0-9_]+$/;

/** Crée ou met à jour un plan dans la table saas_plans (audit plan_created/updated). */
export async function upsertPlan(input: UpsertPlanInput): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis pour éditer les plans.");
  const code = input.code.trim().toLowerCase();
  if (!PLAN_CODE_RE.test(code)) throw new Error("Code plan invalide (a-z, 0-9, _).");
  const pool = await getPool();
  const existing = await pool.query("SELECT id FROM saas_plans WHERE code = $1 LIMIT 1", [code]);
  const id = existing.rows[0]?.id ?? randomUUID();
  await pool.query(
    `INSERT INTO saas_plans
       (id, code, name, description, is_active, is_public, is_default, sort_order,
        monthly_price_cents, yearly_price_cents, currency, max_users, max_documents, max_storage_mb,
        support_level, features)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (code) DO UPDATE SET
       name=EXCLUDED.name, description=EXCLUDED.description, is_active=EXCLUDED.is_active,
       is_public=EXCLUDED.is_public, is_default=EXCLUDED.is_default, sort_order=EXCLUDED.sort_order,
       monthly_price_cents=EXCLUDED.monthly_price_cents, yearly_price_cents=EXCLUDED.yearly_price_cents,
       currency=EXCLUDED.currency, max_users=EXCLUDED.max_users, max_documents=EXCLUDED.max_documents,
       max_storage_mb=EXCLUDED.max_storage_mb, support_level=EXCLUDED.support_level,
       features=EXCLUDED.features, updated_at=now()`,
    [
      id, code, input.name, input.description ?? "", input.isActive ?? true, input.isPublic ?? false,
      input.isDefault ?? false, input.sortOrder ?? 0, input.monthlyPriceCents ?? null, input.yearlyPriceCents ?? null,
      input.currency ?? "EUR", input.maxUsers ?? null, input.maxDocuments ?? null, input.maxStorageMb ?? null,
      input.supportLevel ?? null, input.features ? JSON.stringify(input.features) : null,
    ],
  );
  await recordAudit({ action: existing.rows[0] ? "plan_updated" : "plan_created", target: code });
}
