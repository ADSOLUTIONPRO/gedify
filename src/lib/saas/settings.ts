import "server-only";

import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";
import type { FeatureKey } from "./features";

/* ────────────────────────────────────────────────────────────────────────
   Réglages GLOBAUX du SaaS (persistés en base, table saas_settings, 1 ligne).
   Les SECRETS (SMTP_PASSWORD, STRIPE_SECRET_KEY, ENCRYPTION_MASTER_KEY) ne sont
   JAMAIS stockés ici : ils restent en variables d'environnement.
   Les interrupteurs globaux de fonctionnalités agissent comme un interrupteur
   SUPÉRIEUR : si une fonctionnalité est coupée globalement, aucun plan ne peut
   l'utiliser (cf. applyGlobalFeatureOverrides, branché dans entitlements).
   ──────────────────────────────────────────────────────────────────────── */

export type SaasSettings = {
  signup: {
    publicSignupEnabled: boolean;
    inviteOnly: boolean;
    requireEmailVerification: boolean;
    requireAdminApproval: boolean;
    autoCreateTenant: boolean;
    defaultPlan: string;
    demoTenantAllowed: boolean;
  };
  urls: {
    supportUrl: string;
    termsUrl: string;
    privacyUrl: string;
    primaryDomain: string;
    subdomainsEnabled: boolean;
    customDomainsEnabled: boolean;
  };
  emails: {
    fromName: string;
    supportEmail: string;
    billingEmail: string;
    noreplyEmail: string;
    contactEmail: string;
  };
  limits: {
    maxUsers: number;
    maxDocuments: number;
    maxStorageMb: number;
    maxUploadMb: number;
    maxTestTenants: number;
    maxPendingInvitations: number;
    trialDays: number;
  };
  payment: {
    graceDays: number;
    premiumRestrictDays: number;
    uploadBlockDays: number;
    suspendDays: number;
    autoRemindersEnabled: boolean;
    maxReminders: number;
  };
  security: {
    require2fa: boolean;
    sessionDurationHours: number;
    bruteForceProtection: boolean;
    auditLogsEnabled: boolean;
    maintenanceMode: boolean;
  };
  support: {
    humanSupportEnabled: boolean;
    chatEnabled: boolean;
    ticketsEnabled: boolean;
    attachmentsEnabled: boolean;
    maxAttachmentMb: number;
    hours: string;
    welcomeMessage: string;
  };
  billing: {
    invoicePrefix: string;
    creditNotePrefix: string;
    paymentTermsDays: number;
    defaultVatRate: number;
    currency: string;
  };
  trials: {
    defaultPlan: string;
    fallbackPlan: string;
    reminder7d: boolean;
    reminder3d: boolean;
    reminder1d: boolean;
    expiredEmail: boolean;
    restrictPremiumAfter: boolean;
    suspendAfterDays: number;
    allowManualExtension: boolean;
  };
  features: {
    ai: boolean;
    ocr: boolean;
    emailImport: boolean;
    onlyoffice: boolean;
    mailing: boolean;
    support: boolean;
    marketingCampaigns: boolean;
    publicSignup: boolean;
  };
};

export const DEFAULT_SAAS_SETTINGS: SaasSettings = {
  signup: { publicSignupEnabled: false, inviteOnly: true, requireEmailVerification: true, requireAdminApproval: false, autoCreateTenant: true, defaultPlan: "free", demoTenantAllowed: false },
  urls: { supportUrl: "", termsUrl: "", privacyUrl: "", primaryDomain: "gedify.fr", subdomainsEnabled: false, customDomainsEnabled: false },
  emails: { fromName: "Gedify", supportEmail: "", billingEmail: "", noreplyEmail: "", contactEmail: "" },
  limits: { maxUsers: 5, maxDocuments: 1000, maxStorageMb: 2048, maxUploadMb: 50, maxTestTenants: 5, maxPendingInvitations: 20, trialDays: 14 },
  payment: { graceDays: 7, premiumRestrictDays: 7, uploadBlockDays: 14, suspendDays: 21, autoRemindersEnabled: true, maxReminders: 3 },
  security: { require2fa: false, sessionDurationHours: 168, bruteForceProtection: true, auditLogsEnabled: true, maintenanceMode: false },
  support: { humanSupportEnabled: true, chatEnabled: true, ticketsEnabled: true, attachmentsEnabled: true, maxAttachmentMb: 10, hours: "Lun–Ven 9h–18h", welcomeMessage: "Bonjour 👋 Comment pouvons-nous vous aider ?" },
  billing: { invoicePrefix: "FAC", creditNotePrefix: "AVOIR", paymentTermsDays: 30, defaultVatRate: 20, currency: "EUR" },
  trials: { defaultPlan: "pro", fallbackPlan: "free", reminder7d: true, reminder3d: true, reminder1d: true, expiredEmail: true, restrictPremiumAfter: true, suspendAfterDays: 30, allowManualExtension: true },
  features: { ai: true, ocr: true, emailImport: true, onlyoffice: true, mailing: true, support: true, marketingCampaigns: true, publicSignup: false },
};

const ROW_ID = "global";
let cache: { value: SaasSettings; at: number } | null = null;
const TTL_MS = 10_000;

function deepMerge<T>(base: T, override: unknown): T {
  if (override == null || typeof override !== "object") return base;
  const out = Array.isArray(base) ? ([...(base as unknown[])] as T) : ({ ...(base as object) } as T);
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    const cur = (out as Record<string, unknown>)[k];
    if (cur && typeof cur === "object" && !Array.isArray(cur) && v && typeof v === "object" && !Array.isArray(v)) {
      (out as Record<string, unknown>)[k] = deepMerge(cur, v);
    } else if (v !== undefined) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/** Réglages courants (defaults ⊕ base). Mise en cache courte (10 s). */
export async function getSaasSettings(): Promise<SaasSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = DEFAULT_SAAS_SETTINGS;
  if (postgresActive()) {
    try {
      const pool = await getPool();
      const { rows } = await pool.query("SELECT data FROM saas_settings WHERE id = $1 LIMIT 1", [ROW_ID]);
      if (rows[0]?.data) value = deepMerge(DEFAULT_SAAS_SETTINGS, rows[0].data);
    } catch { /* table absente → defaults */ }
  }
  cache = { value, at: Date.now() };
  return value;
}

export type SettingsSection = keyof SaasSettings;

/** Met à jour une section (fusion). Persiste en base + audit. */
export async function updateSaasSettings(section: SettingsSection, patch: Record<string, unknown>, actor?: string): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  await pool.query(`CREATE TABLE IF NOT EXISTS saas_settings (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const current = await getSaasSettings();
  const next = deepMerge(current, { [section]: patch });
  await pool.query(
    `INSERT INTO saas_settings(id, data) VALUES ($1,$2)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [ROW_ID, JSON.stringify(next)],
  );
  cache = null;
  await recordAudit({ action: "saas_settings_updated", target: section, details: Object.keys(patch).join(","), user: actor });
}

/** Vue publique (sans rien de sensible) — pour pages publiques/pricing. */
export async function getPublicSaasSettings(): Promise<{
  signupOpen: boolean; inviteOnly: boolean; supportUrl: string; termsUrl: string; privacyUrl: string; maintenanceMode: boolean;
}> {
  const s = await getSaasSettings();
  return {
    signupOpen: s.features.publicSignup && s.signup.publicSignupEnabled,
    inviteOnly: s.signup.inviteOnly,
    supportUrl: s.urls.supportUrl,
    termsUrl: s.urls.termsUrl,
    privacyUrl: s.urls.privacyUrl,
    maintenanceMode: s.security.maintenanceMode,
  };
}

/* ── Interrupteur global de fonctionnalités (master switch) ───────────────── */

export type GlobalFeature = keyof SaasSettings["features"];

/** Préfixes de clés granulaires coupées si l'interrupteur global est OFF. */
const GLOBAL_FEATURE_MAP: Record<GlobalFeature, string[]> = {
  ai: ["ai_", "advanced_search_ai"],
  ocr: ["ocr_"],
  emailImport: ["email_import", "google_contacts", "contact_sync"],
  onlyoffice: ["onlyoffice", "collaborative_editing"],
  mailing: [], // gère l'envoi via EMAILS_ENABLED ; pas de feature plan dédiée
  support: ["human_support", "priority_support", "support_attachments", "ai_support"],
  marketingCampaigns: [],
  publicSignup: [],
};

export async function isGlobalFeatureEnabled(feature: GlobalFeature): Promise<boolean> {
  const s = await getSaasSettings();
  return s.features[feature] === true;
}

export async function assertGlobalFeatureEnabled(feature: GlobalFeature): Promise<void> {
  if (!(await isGlobalFeatureEnabled(feature))) {
    throw new Error(`Fonctionnalité « ${feature} » désactivée globalement par l'administrateur.`);
  }
}

/**
 * Applique les interrupteurs globaux à une map de features (plan effectif) :
 * toute clé rattachée à un interrupteur OFF est forcée à false.
 */
export function applyGlobalFeatureOverrides(features: Record<FeatureKey, boolean>, settings: SaasSettings): Record<FeatureKey, boolean> {
  const out = { ...features };
  for (const [flag, prefixes] of Object.entries(GLOBAL_FEATURE_MAP) as [GlobalFeature, string[]][]) {
    if (settings.features[flag]) continue; // activé globalement → rien à couper
    if (prefixes.length === 0) continue;
    for (const key of Object.keys(out)) {
      if (prefixes.some((p) => key.startsWith(p))) out[key] = false;
    }
  }
  return out;
}

/* ── Politiques dérivées (helpers) ───────────────────────────────────────── */

export async function getPaymentPolicy() { return (await getSaasSettings()).payment; }
export async function getSignupPolicy() { return (await getSaasSettings()).signup; }
export async function getSupportPolicy() { return (await getSaasSettings()).support; }
export async function getTrialPolicy() { return (await getSaasSettings()).trials; }
