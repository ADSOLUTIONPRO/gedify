import "server-only";

import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pg";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getActiveTenantId } from "@/lib/tenant/get-current-tenant";
import { countTenantMembers } from "@/lib/tenant/tenant-store";

/* ────────────────────────────────────────────────────────────────────────
   Plans, quotas et restrictions fonctionnelles (Phase 7).

   TOUT est gardé par MULTI_TENANT + un tenant actif résolu : en mono-tenant /
   local / Synology, ou hors contexte tenant, les vérifications sont des NO-OP
   (comportement inchangé). La source de vérité des limites effectives est
   `tenant_settings` (renseigné à la création / via « appliquer le plan » /
   surcharge manuelle) ; à défaut, on retombe sur les défauts du plan.
   ──────────────────────────────────────────────────────────────────────── */

export type SaasFeature = "ai" | "ocr" | "emailImport" | "onlyoffice";

export type EffectiveLimits = {
  planId: string;
  maxUsers: number | null;
  maxDocuments: number | null;
  maxStorageMb: number | null;
  aiEnabled: boolean;
  ocrEnabled: boolean;
  emailImportEnabled: boolean;
  onlyofficeEnabled: boolean;
};

export type TenantUsage = { users: number; documents: number; storageMb: number };

export type QuotaCheck = { ok: boolean; used: number; limit: number | null; message: string | null };

export class QuotaError extends Error {
  constructor(
    message: string,
    readonly code: "documents" | "users" | "storage" | SaasFeature,
  ) {
    super(message);
    this.name = "QuotaError";
  }
}

const FEATURE_MESSAGE: Record<SaasFeature, string> = {
  ai: "La fonction IA n'est pas disponible dans votre offre.",
  ocr: "L'OCR n'est pas disponible dans votre offre.",
  emailImport: "L'import d'e-mails n'est pas disponible dans votre offre.",
  onlyoffice: "L'édition OnlyOffice n'est pas disponible dans votre offre.",
};

const FEATURE_FLAG: Record<SaasFeature, keyof EffectiveLimits> = {
  ai: "aiEnabled",
  ocr: "ocrEnabled",
  emailImport: "emailImportEnabled",
  onlyoffice: "onlyofficeEnabled",
};

/**
 * Limites EFFECTIVES d'un tenant — déléguées aux DROITS EFFECTIFS (entitlements :
 * gratuité > abonnement actif > tenant.plan > free ; définition via plan-store
 * avec fallback plans.ts ; features fusionnées). Source unique pour les quotas.
 */
export async function getTenantPlanLimits(tenantId: string): Promise<EffectiveLimits> {
  const { getTenantEntitlements } = await import("./entitlements");
  const ent = await getTenantEntitlements(tenantId);
  return {
    planId: ent.planCode,
    maxUsers: ent.limits.maxUsers,
    maxDocuments: ent.limits.maxDocuments,
    maxStorageMb: ent.limits.maxStorageMb,
    aiEnabled: ent.features.ai_enabled === true,
    ocrEnabled: ent.features.ocr_enabled === true,
    emailImportEnabled: ent.features.email_import_enabled === true,
    onlyofficeEnabled: ent.features.onlyoffice_enabled === true,
  };
}

async function scalar(sql: string, params: unknown[]): Promise<number> {
  try {
    const pool = await getPool();
    const { rows } = await pool.query(sql, params);
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

/** Usage courant d'un tenant. storageMb : best-effort (somme de raw->>'archiveSize'). */
export async function getTenantUsage(tenantId: string): Promise<TenantUsage> {
  const users = await countTenantMembers(tenantId).catch(() => 0);
  const documents = await scalar(
    `SELECT COUNT(*)::int AS n FROM documents
      WHERE tenant_id = $1 AND COALESCE((raw->>'deleted')::boolean, false) = false`,
    [tenantId],
  );
  const bytes = await scalar(
    `SELECT COALESCE(SUM(NULLIF(raw->>'archiveSize','')::bigint), 0)::bigint AS n FROM documents
      WHERE tenant_id = $1 AND COALESCE((raw->>'deleted')::boolean, false) = false`,
    [tenantId],
  );
  return { users, documents, storageMb: Math.round(bytes / (1024 * 1024)) };
}

/* ── Vérifications (pures) ──────────────────────────────────────────────── */

export async function checkDocumentQuota(tenantId: string, add = 1): Promise<QuotaCheck> {
  const limit = (await getTenantPlanLimits(tenantId)).maxDocuments;
  const used = (await getTenantUsage(tenantId)).documents;
  const ok = limit == null || used + add <= limit;
  return { ok, used, limit, message: ok ? null : "Limite de documents atteinte pour votre offre." };
}

export async function checkUserQuota(tenantId: string, add = 1): Promise<QuotaCheck> {
  const limit = (await getTenantPlanLimits(tenantId)).maxUsers;
  const used = await countTenantMembers(tenantId).catch(() => 0);
  const ok = limit == null || used + add <= limit;
  return { ok, used, limit, message: ok ? null : "Limite d'utilisateurs atteinte pour votre offre." };
}

export async function checkStorageQuota(tenantId: string, addMb = 0): Promise<QuotaCheck> {
  const limit = (await getTenantPlanLimits(tenantId)).maxStorageMb;
  const used = (await getTenantUsage(tenantId)).storageMb;
  const ok = limit == null || used + addMb <= limit;
  return { ok, used, limit, message: ok ? null : "Le stockage maximum de votre espace est atteint." };
}

/* ── Fonctionnalités ────────────────────────────────────────────────────── */

export async function featureEnabled(tenantId: string, feature: SaasFeature): Promise<boolean> {
  const limits = await getTenantPlanLimits(tenantId);
  return Boolean(limits[FEATURE_FLAG[feature]]);
}

export async function assertFeatureEnabled(tenantId: string, feature: SaasFeature): Promise<void> {
  if (!(await featureEnabled(tenantId, feature))) {
    throw new QuotaError(FEATURE_MESSAGE[feature], feature);
  }
}

export async function canUseAi(tenantId: string): Promise<boolean> {
  return featureEnabled(tenantId, "ai");
}
export async function canUseOcr(tenantId: string): Promise<boolean> {
  return featureEnabled(tenantId, "ocr");
}
export async function canUseEmailImport(tenantId: string): Promise<boolean> {
  return featureEnabled(tenantId, "emailImport");
}
export async function canUseOnlyOffice(tenantId: string): Promise<boolean> {
  return featureEnabled(tenantId, "onlyoffice");
}

/* ── Application aux flux (gated MULTI_TENANT + tenant actif) ──────────────── */

/** Lève QuotaError si le tenant actif dépasse documents/stockage. No-op hors SaaS. */
export async function enforceDocumentQuota(sizeBytes = 0): Promise<void> {
  if (!isMultiTenantEnabled()) return;
  const tenantId = await getActiveTenantId();
  if (!tenantId) return;
  const limits = await getTenantPlanLimits(tenantId);
  const usage = await getTenantUsage(tenantId);
  if (limits.maxDocuments != null && usage.documents >= limits.maxDocuments) {
    throw new QuotaError("Limite de documents atteinte pour votre offre.", "documents");
  }
  if (limits.maxStorageMb != null && usage.storageMb + sizeBytes / (1024 * 1024) > limits.maxStorageMb) {
    throw new QuotaError("Le stockage maximum de votre espace est atteint.", "storage");
  }
}

/* ── Gardes pour routes API (retournent une réponse 403, ou null si OK) ───── */

/** 403 propre si la fonctionnalité est désactivée pour le tenant actif. */
export async function featureGate(feature: SaasFeature): Promise<NextResponse | null> {
  if (!isMultiTenantEnabled()) return null;
  const tenantId = await getActiveTenantId();
  if (!tenantId) return null;
  if (await featureEnabled(tenantId, feature)) return null;
  return NextResponse.json({ error: FEATURE_MESSAGE[feature], errorType: "saas_quota" }, { status: 403 });
}

/** 403 propre si le quota d'utilisateurs est atteint pour le tenant actif. */
export async function userQuotaGate(add = 1): Promise<NextResponse | null> {
  if (!isMultiTenantEnabled()) return null;
  const tenantId = await getActiveTenantId();
  if (!tenantId) return null;
  const check = await checkUserQuota(tenantId, add);
  if (check.ok) return null;
  return NextResponse.json({ error: check.message, errorType: "saas_quota" }, { status: 403 });
}

/** 403 propre si le quota documents/stockage est atteint pour le tenant actif. */
export async function documentQuotaGate(sizeBytes = 0): Promise<NextResponse | null> {
  if (!isMultiTenantEnabled()) return null;
  try {
    await enforceDocumentQuota(sizeBytes);
    return null;
  } catch (e) {
    if (e instanceof QuotaError) {
      return NextResponse.json({ error: e.message, errorType: "saas_quota" }, { status: 403 });
    }
    return null;
  }
}
