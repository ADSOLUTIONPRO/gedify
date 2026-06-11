import "server-only";

import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { createUser, listUsers } from "@/lib/engine/users";
import { recordAudit } from "@/lib/audit/audit-store";
import { getTenantById, getTenantBySlug, getTenantSettings } from "./tenant-store";
import { getPlan } from "@/lib/saas/plans";

/* ────────────────────────────────────────────────────────────────────────
   Couche d'administration des tenants (ÉCRITURE) — superuser uniquement
   (la garde superuser est posée par les server actions appelantes).
   Postgres requis (fonctionnalité SaaS). Journalise via recordAudit.
   ──────────────────────────────────────────────────────────────────────── */

export const TENANT_PLANS = ["free", "test", "pro", "business", "internal"] as const;
export const TENANT_STATUSES = ["active", "trial", "suspended"] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];
export type TenantStatusValue = (typeof TENANT_STATUSES)[number];

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function assertPostgres() {
  if (!postgresActive()) throw new Error("Postgres requis (DATABASE_URL + mode postgres).");
}

export type CreateTenantInput = {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerUsername: string;
  ownerPassword?: string;
  plan: string;
  status: string;
  maxUsers?: number | null;
  maxDocuments?: number | null;
  maxStorageMb?: number | null;
  aiEnabled: boolean;
  ocrEnabled: boolean;
  emailImportEnabled: boolean;
  onlyofficeEnabled: boolean;
};

export type CreateTenantResult = { tenantId: string; ownerId: number; ownerCreated: boolean };

/**
 * Crée un tenant + son owner (créé ou réutilisé) + membership + tenant_settings.
 * Idempotent sur les sous-objets (ON CONFLICT DO NOTHING). Refuse un slug déjà
 * pris et une incohérence email/identifiant. NE crée aucune donnée métier.
 */
export async function createTenantWithOwner(input: CreateTenantInput): Promise<CreateTenantResult> {
  assertPostgres();

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const email = input.ownerEmail.trim().toLowerCase();
  const username = input.ownerUsername.trim();
  const plan = input.plan.trim().toLowerCase();
  const status = input.status.trim().toLowerCase();

  if (!name) throw new Error("Le nom de l'organisation est requis.");
  if (!SLUG_RE.test(slug)) throw new Error("Slug invalide (minuscules, chiffres, tirets ; 2–40 caractères).");
  if (!EMAIL_RE.test(email)) throw new Error("E-mail propriétaire invalide.");
  if (username.length < 3) throw new Error("Identifiant propriétaire trop court (≥ 3).");
  if (!(TENANT_PLANS as readonly string[]).includes(plan)) throw new Error(`Plan invalide : ${plan}.`);
  if (!(TENANT_STATUSES as readonly string[]).includes(status)) throw new Error(`Statut invalide : ${status}.`);

  // Refus des doublons slug.
  if ((await getTenantById(slug)) || (await getTenantBySlug(slug))) {
    throw new Error(`Le slug « ${slug} » est déjà utilisé.`);
  }

  // Owner : réutilisation si l'e-mail OU l'identifiant existe déjà ; refus si les
  // deux pointent vers des comptes différents (incohérence).
  const users = await listUsers();
  const byEmail = users.find((u) => (u.email ?? "").trim().toLowerCase() === email) ?? null;
  const byUsername = users.find((u) => u.username.trim().toLowerCase() === username.toLowerCase()) ?? null;
  if (byEmail && byUsername && byEmail.id !== byUsername.id) {
    throw new Error("E-mail et identifiant correspondent à deux comptes différents.");
  }
  let owner = byEmail ?? byUsername ?? null;
  let ownerCreated = false;
  if (!owner) {
    const password = input.ownerPassword ?? "";
    if (password.length < 8) throw new Error("Mot de passe temporaire requis (≥ 8 caractères).");
    owner = await createUser({ username, email, password, is_superuser: false, is_staff: false });
    ownerCreated = true;
  }
  const ownerId = owner.id;

  const pool = await getPool();
  await pool.query(
    `INSERT INTO tenants(id, name, slug, plan, status) VALUES($1, $2, $3, $4, $5)
     ON CONFLICT(id) DO NOTHING`,
    [slug, name, slug, plan, status],
  );
  await pool.query(
    `INSERT INTO memberships(id, user_id, tenant_id, role) VALUES($1, $2, $3, 'owner')
     ON CONFLICT(id) DO NOTHING`,
    [`${slug}:${ownerId}`, ownerId, slug],
  );
  await pool.query(
    `INSERT INTO tenant_settings
       (id, tenant_id, max_users, max_documents, max_storage_mb,
        ai_enabled, ocr_enabled, email_import_enabled, onlyoffice_enabled)
     VALUES($1, $1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT(id) DO NOTHING`,
    [
      slug,
      input.maxUsers ?? null,
      input.maxDocuments ?? null,
      input.maxStorageMb ?? null,
      input.aiEnabled,
      input.ocrEnabled,
      input.emailImportEnabled,
      input.onlyofficeEnabled,
    ],
  );

  await recordAudit({ action: "tenant_created", target: slug, details: `plan=${plan} status=${status} owner=${owner.username}` });
  await recordAudit({ action: "membership_created", target: `${slug}:${ownerId}`, details: "role=owner" });
  await recordAudit({ action: "tenant_settings_updated", target: slug, details: "init" });

  return { tenantId: slug, ownerId, ownerCreated };
}

/** Met à jour plan et/ou statut d'un tenant (audit : tenant_updated / tenant_suspended). */
export async function updateTenant(
  tenantId: string,
  patch: { plan?: string; status?: string },
): Promise<void> {
  assertPostgres();
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error(`Tenant introuvable : ${tenantId}.`);

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.plan != null) {
    const plan = patch.plan.trim().toLowerCase();
    if (!(TENANT_PLANS as readonly string[]).includes(plan)) throw new Error(`Plan invalide : ${plan}.`);
    sets.push(`plan = $${i++}`);
    vals.push(plan);
  }
  if (patch.status != null) {
    const status = patch.status.trim().toLowerCase();
    if (!(TENANT_STATUSES as readonly string[]).includes(status)) throw new Error(`Statut invalide : ${status}.`);
    sets.push(`status = $${i++}`);
    vals.push(status);
  }
  if (sets.length === 0) return;
  sets.push(`updated_at = now()`);
  vals.push(tenantId);
  const pool = await getPool();
  await pool.query(`UPDATE tenants SET ${sets.join(", ")} WHERE id = $${i}`, vals);

  await recordAudit({
    action: patch.status === "suspended" ? "tenant_suspended" : "tenant_updated",
    target: tenantId,
    details: [patch.plan ? `plan=${patch.plan}` : null, patch.status ? `status=${patch.status}` : null].filter(Boolean).join(" "),
  });
}

export type TenantSettingsPatch = {
  maxUsers?: number | null;
  maxDocuments?: number | null;
  maxStorageMb?: number | null;
  aiEnabled?: boolean;
  ocrEnabled?: boolean;
  emailImportEnabled?: boolean;
  onlyofficeEnabled?: boolean;
};

/** Upsert des limites/fonctionnalités d'un tenant (audit : tenant_settings_updated). */
export async function updateTenantSettings(tenantId: string, patch: TenantSettingsPatch): Promise<void> {
  assertPostgres();
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error(`Tenant introuvable : ${tenantId}.`);

  const current = await getTenantSettings(tenantId);
  const merged = {
    maxUsers: patch.maxUsers !== undefined ? patch.maxUsers : current?.maxUsers ?? null,
    maxDocuments: patch.maxDocuments !== undefined ? patch.maxDocuments : current?.maxDocuments ?? null,
    maxStorageMb: patch.maxStorageMb !== undefined ? patch.maxStorageMb : current?.maxStorageMb ?? null,
    aiEnabled: patch.aiEnabled !== undefined ? patch.aiEnabled : current?.aiEnabled ?? true,
    ocrEnabled: patch.ocrEnabled !== undefined ? patch.ocrEnabled : current?.ocrEnabled ?? true,
    emailImportEnabled: patch.emailImportEnabled !== undefined ? patch.emailImportEnabled : current?.emailImportEnabled ?? true,
    onlyofficeEnabled: patch.onlyofficeEnabled !== undefined ? patch.onlyofficeEnabled : current?.onlyofficeEnabled ?? true,
  };
  const pool = await getPool();
  await pool.query(
    `INSERT INTO tenant_settings
       (id, tenant_id, max_users, max_documents, max_storage_mb,
        ai_enabled, ocr_enabled, email_import_enabled, onlyoffice_enabled)
     VALUES($1, $1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(id) DO UPDATE SET
       max_users = EXCLUDED.max_users, max_documents = EXCLUDED.max_documents,
       max_storage_mb = EXCLUDED.max_storage_mb, ai_enabled = EXCLUDED.ai_enabled,
       ocr_enabled = EXCLUDED.ocr_enabled, email_import_enabled = EXCLUDED.email_import_enabled,
       onlyoffice_enabled = EXCLUDED.onlyoffice_enabled, updated_at = now()`,
    [
      tenantId,
      merged.maxUsers,
      merged.maxDocuments,
      merged.maxStorageMb,
      merged.aiEnabled,
      merged.ocrEnabled,
      merged.emailImportEnabled,
      merged.onlyofficeEnabled,
    ],
  );
  await recordAudit({ action: "tenant_settings_updated", target: tenantId, details: "edit" });
}

/** Suspend ou réactive un tenant (raccourci sur updateTenant). */
export async function setTenantStatus(tenantId: string, status: TenantStatusValue): Promise<void> {
  await updateTenant(tenantId, { status });
}

/** Recopie les limites/fonctionnalités du PLAN du tenant dans tenant_settings. */
export async function applyPlanToSettings(tenantId: string): Promise<void> {
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error(`Tenant introuvable : ${tenantId}.`);
  const plan = getPlan(tenant.plan);
  await updateTenantSettings(tenantId, {
    maxUsers: plan.maxUsers,
    maxDocuments: plan.maxDocuments,
    maxStorageMb: plan.maxStorageMb,
    aiEnabled: plan.aiEnabled,
    ocrEnabled: plan.ocrEnabled,
    emailImportEnabled: plan.emailImportEnabled,
    onlyofficeEnabled: plan.onlyofficeEnabled,
  });
}
