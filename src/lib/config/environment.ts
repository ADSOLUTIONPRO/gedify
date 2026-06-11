import "server-only";

/* ────────────────────────────────────────────────────────────────────────
   Configuration d'ENVIRONNEMENT (préparation SaaS Coolify staging/prod).

   Centralise la lecture des variables d'environnement liées au déploiement.
   Toutes les valeurs sont lues au RUNTIME (process.env) → compatibles avec
   Coolify (Nixpacks), Docker Synology et le mode bureau local sans rebuild.

   ⚠️ RÈGLE ABSOLUE (cf. page /admin/system/environment) : ce module peut
   exposer la PRÉSENCE et les valeurs NON SENSIBLES d'une variable, mais JAMAIS
   la valeur d'un secret (DATABASE_URL complète, clés API, tokens, mots de
   passe, AUTH_SECRET…). Les helpers `*Configured` ne renvoient qu'un booléen.

   Cette préparation NE modifie PAS le comportement existant : les nouvelles
   variables (APP_ENV, REDIS_URL, STORAGE_*) ont des valeurs par défaut sûres
   et n'affectent ni Synology ni la version stable `main`.
   ──────────────────────────────────────────────────────────────────────── */

export type AppEnv = "development" | "staging" | "production";

/** Normalise une valeur libre (APP_ENV / NEXT_PUBLIC_APP_ENV) vers un AppEnv. */
function normalizeAppEnv(raw: string | undefined): AppEnv | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  if (v === "production" || v === "prod") return "production";
  if (v === "staging" || v === "stage" || v === "preprod" || v === "preproduction")
    return "staging";
  if (v === "development" || v === "dev" || v === "local") return "development";
  return null;
}

/**
 * Environnement applicatif effectif (côté serveur).
 * Priorité : APP_ENV → NEXT_PUBLIC_APP_ENV → déduit de NODE_ENV.
 */
export function getAppEnv(): AppEnv {
  return (
    normalizeAppEnv(process.env.APP_ENV) ??
    normalizeAppEnv(process.env.NEXT_PUBLIC_APP_ENV) ??
    (process.env.NODE_ENV === "production" ? "production" : "development")
  );
}

/**
 * Environnement « public » (celui exposé au navigateur via NEXT_PUBLIC_APP_ENV).
 * Sert au bandeau d'environnement. Retombe sur APP_ENV puis NODE_ENV.
 */
export function getPublicAppEnv(): AppEnv {
  return (
    normalizeAppEnv(process.env.NEXT_PUBLIC_APP_ENV) ??
    normalizeAppEnv(process.env.APP_ENV) ??
    (process.env.NODE_ENV === "production" ? "production" : "development")
  );
}

export function isStaging(): boolean {
  return getAppEnv() === "staging";
}

export function isProduction(): boolean {
  return getAppEnv() === "production";
}

/**
 * Environnement SaaS (Coolify) = staging OU production. Sert à imposer le
 * backend PostgreSQL (cf. getStorageMode / assertSaaSStorageBackend).
 * Le développement local et le déploiement Synology ne sont JAMAIS « SaaS ».
 */
export function isSaaS(): boolean {
  const e = getAppEnv();
  return e === "staging" || e === "production";
}

/** Une URL de connexion PostgreSQL ? (`postgresql://` ou `postgres://`). */
export function isPostgresUrl(url: string | undefined | null): boolean {
  const u = url?.trim().toLowerCase() ?? "";
  return u.startsWith("postgresql://") || u.startsWith("postgres://");
}

/* ── URLs ──────────────────────────────────────────────────────────────── */

/** URL applicative côté serveur (APP_URL), ou null si non configurée. */
export function getAppUrl(): string | null {
  return process.env.APP_URL?.trim() || null;
}

/** URL publique (NEXT_PUBLIC_APP_URL), retombe sur APP_URL. */
export function getPublicAppUrl(): string | null {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || null;
}

/* ── File / blob storage (préparation SaaS) ────────────────────────────────
   Distinct de GEDIFY_STORAGE_MODE (json/sqlite/postgres = stockage des
   MÉTADONNÉES en base). Ici on décrit le stockage des FICHIERS :
   - STORAGE_DRIVER : "local" (défaut) | "s3" | autre pilote futur.
   - STORAGE_ROOT   : racine du stockage (chemin disque ou bucket).
   - STORAGE_PREFIX : préfixe de clés (utile pour isoler staging/prod ou,
     plus tard, un tenant) — vide par défaut.
   ──────────────────────────────────────────────────────────────────────── */

export function getStorageDriver(): string {
  return process.env.STORAGE_DRIVER?.trim().toLowerCase() || "local";
}

export function getStorageRoot(): string {
  return (
    process.env.STORAGE_ROOT?.trim() ||
    process.env.DATA_DIR?.trim() ||
    "(défaut)"
  );
}

export function getStoragePrefix(): string {
  return process.env.STORAGE_PREFIX?.trim() || "";
}

/* ── Cache / file d'attente ────────────────────────────────────────────── */

/** Présence d'une URL Redis (REDIS_URL) — sans jamais exposer la valeur. */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

/* ── Diagnostic SANS secret (page /admin/system/environment) ─────────────── */

export type EnvironmentDiagnostics = {
  /** Environnement applicatif effectif. */
  appEnv: AppEnv;
  /** Environnement exposé au navigateur. */
  publicAppEnv: AppEnv;
  /** APP_URL renseignée ? (valeur non exposée par prudence). */
  appUrlConfigured: boolean;
  /** NEXT_PUBLIC_APP_URL — non sensible (déjà exposée au client). */
  publicAppUrl: string | null;
  /** DATABASE_URL renseignée ? (valeur JAMAIS exposée). */
  databaseUrlConfigured: boolean;
  /** REDIS_URL renseignée ? (valeur JAMAIS exposée). */
  redisUrlConfigured: boolean;
  /** Pilote de stockage des fichiers (local / s3 / …). */
  storageDriver: string;
  /** Racine de stockage (chemin/bucket) — non sensible. */
  storageRoot: string;
  /** Préfixe de clés de stockage — non sensible. */
  storagePrefix: string;
  /** Fournisseur IA actif (mock par défaut) — non sensible. */
  aiProvider: string;
  /** Envoi d'emails activé ? (EMAILS_ENABLED). */
  emailsEnabled: boolean;
  /** Chiffrement au repos configuré ? (ENCRYPTION_MASTER_KEY présente — jamais la valeur). */
  encryptionConfigured: boolean;
  /** Mode Stripe : "test" | "live" | "off" (jamais la clé). */
  stripeMode: string;
  /** Horodatage de génération du rapport. */
  generatedAt: string;
};

/** Interprète EMAILS_ENABLED (true/1/yes/on). Défaut : désactivé. */
export function areEmailsEnabled(): boolean {
  const v = process.env.EMAILS_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/** Mode Stripe lisible, sans jamais lire/exposer STRIPE_SECRET_KEY. */
export function getStripeMode(): string {
  const v = process.env.STRIPE_MODE?.trim().toLowerCase();
  if (v === "live" || v === "production") return "live";
  if (v === "test" || v === "sandbox") return "test";
  return "off";
}

/**
 * Construit le rapport d'environnement affiché dans la page d'admin.
 * Ne renvoie QUE des données non sensibles (présences + valeurs publiques).
 */
export function getEnvironmentDiagnostics(): EnvironmentDiagnostics {
  return {
    appEnv: getAppEnv(),
    publicAppEnv: getPublicAppEnv(),
    appUrlConfigured: Boolean(getAppUrl()),
    publicAppUrl: getPublicAppUrl(),
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    redisUrlConfigured: isRedisConfigured(),
    storageDriver: getStorageDriver(),
    storageRoot: getStorageRoot(),
    storagePrefix: getStoragePrefix(),
    aiProvider: process.env.AI_PROVIDER?.trim().toLowerCase() || "mock",
    emailsEnabled: areEmailsEnabled(),
    encryptionConfigured: Boolean(process.env.ENCRYPTION_MASTER_KEY?.trim()),
    stripeMode: getStripeMode(),
    generatedAt: new Date().toISOString(),
  };
}
