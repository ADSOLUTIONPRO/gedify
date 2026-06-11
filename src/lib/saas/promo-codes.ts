import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";

/* Codes promo (table promo_codes). Préparé pour Stripe (coupon/promotion code). */

export const DISCOUNT_TYPES = ["percent", "amount", "free_period", "free_forever"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export type PromoCode = {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  discountType: string | null;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string;
  freeDurationCount: number | null;
  freeDurationUnit: string | null;
  appliesToPlan: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string | null;
};

function iso(v: unknown): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}
function rowToPromo(r: Record<string, unknown>): PromoCode {
  return {
    id: String(r.id), code: String(r.code), name: (r.name as string) ?? null, description: (r.description as string) ?? null,
    discountType: (r.discount_type as string) ?? null, percentOff: r.percent_off == null ? null : Number(r.percent_off),
    amountOffCents: r.amount_off_cents == null ? null : Number(r.amount_off_cents), currency: (r.currency as string) ?? "EUR",
    freeDurationCount: r.free_duration_count == null ? null : Number(r.free_duration_count),
    freeDurationUnit: (r.free_duration_unit as string) ?? null, appliesToPlan: (r.applies_to_plan as string) ?? null,
    maxRedemptions: r.max_redemptions == null ? null : Number(r.max_redemptions), redeemedCount: Number(r.redeemed_count ?? 0),
    startsAt: iso(r.starts_at), expiresAt: iso(r.expires_at), isActive: r.is_active !== false, createdAt: iso(r.created_at),
  };
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM promo_codes ORDER BY created_at DESC");
    return rows.map(rowToPromo);
  } catch {
    return [];
  }
}

export type CreatePromoInput = {
  code: string;
  name?: string;
  description?: string;
  discountType: string;
  percentOff?: number | null;
  amountOffCents?: number | null;
  freeDurationCount?: number | null;
  freeDurationUnit?: string | null;
  appliesToPlan?: string | null;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
};

const CODE_RE = /^[A-Z0-9_-]{2,40}$/;

export async function createPromoCode(input: CreatePromoInput): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const code = input.code.trim().toUpperCase();
  if (!CODE_RE.test(code)) throw new Error("Code invalide (A-Z, 0-9, -, _).");
  if (!(DISCOUNT_TYPES as readonly string[]).includes(input.discountType)) throw new Error("Type de remise invalide.");
  const pool = await getPool();
  const exists = await pool.query("SELECT id FROM promo_codes WHERE code = $1 LIMIT 1", [code]);
  if (exists.rows[0]) throw new Error(`Le code « ${code} » existe déjà.`);
  await pool.query(
    `INSERT INTO promo_codes
       (id, code, name, description, discount_type, percent_off, amount_off_cents,
        free_duration_count, free_duration_unit, applies_to_plan, max_redemptions, expires_at, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      randomUUID(), code, input.name ?? null, input.description ?? null, input.discountType,
      input.percentOff ?? null, input.amountOffCents ?? null, input.freeDurationCount ?? null,
      input.freeDurationUnit ?? null, input.appliesToPlan ?? null, input.maxRedemptions ?? null,
      input.expiresAt ?? null, input.isActive ?? true,
    ],
  );
  await recordAudit({ action: "promo_code_created", target: code, details: `type=${input.discountType}` });
}

export async function setPromoActive(id: string, active: boolean): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  await pool.query("UPDATE promo_codes SET is_active = $1, updated_at = now() WHERE id = $2", [active, id]);
  await recordAudit({ action: "promo_code_updated", target: id, details: `is_active=${active}` });
}
