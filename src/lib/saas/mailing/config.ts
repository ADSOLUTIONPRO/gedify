import "server-only";

import { areEmailsEnabled } from "@/lib/config/environment";

/* Configuration SMTP du mailing transactionnel (o2switch ou autre).
   ⚠️ SMTP_PASSWORD n'est JAMAIS exposé ni loggé. */

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean; // true = 465 (SSL/TLS), false = 587 (STARTTLS)
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

/** Le mailing est-il activé ? (EMAILS_ENABLED). */
export function isMailingEnabled(): boolean {
  return areEmailsEnabled();
}

function trimmed(key: string): string {
  return process.env[key]?.trim() ?? "";
}

/** Renvoie la config SMTP complète (avec secret). Usage serveur uniquement. */
export function getSmtpConfig(): SmtpConfig | null {
  const host = trimmed("SMTP_HOST");
  const user = trimmed("SMTP_USER") || trimmed("SMTP_USERNAME");
  const pass = process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS ?? "";
  const fromEmail = trimmed("MAIL_FROM") || trimmed("SMTP_FROM") || user;
  if (!host || !user || !pass || !fromEmail) return null;
  const portRaw = Number(trimmed("SMTP_PORT") || "465");
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 465;
  const secureRaw = trimmed("SMTP_SECURE").toLowerCase();
  const secure = secureRaw ? secureRaw === "true" || secureRaw === "1" || secureRaw === "yes" : port === 465;
  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName: trimmed("MAIL_FROM_NAME") || "Gedify",
  };
}

/** État de configuration SANS secret (pour pages/diagnostics). */
export type SmtpStatus = {
  enabled: boolean;
  hostConfigured: boolean;
  userConfigured: boolean;
  passwordConfigured: boolean;
  fromConfigured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean | null;
  fromEmail: string | null;
  fromName: string | null;
  ready: boolean;
};

export function getSmtpStatus(): SmtpStatus {
  const host = trimmed("SMTP_HOST");
  const user = trimmed("SMTP_USER") || trimmed("SMTP_USERNAME");
  const passwordConfigured = Boolean(process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS);
  const fromEmail = trimmed("MAIL_FROM") || trimmed("SMTP_FROM") || user || null;
  const cfg = getSmtpConfig();
  return {
    enabled: isMailingEnabled(),
    hostConfigured: Boolean(host),
    userConfigured: Boolean(user),
    passwordConfigured,
    fromConfigured: Boolean(fromEmail),
    host: host || null,
    port: cfg?.port ?? (trimmed("SMTP_PORT") ? Number(trimmed("SMTP_PORT")) : null),
    secure: cfg?.secure ?? null,
    fromEmail,
    fromName: trimmed("MAIL_FROM_NAME") || null,
    ready: Boolean(cfg) && isMailingEnabled(),
  };
}

/** Lève si le mailing est désactivé ou mal configuré. */
export function requireMailingReady(): SmtpConfig {
  if (!isMailingEnabled()) throw new Error("Mailing désactivé (EMAILS_ENABLED=false).");
  const cfg = getSmtpConfig();
  if (!cfg) throw new Error("Configuration SMTP incomplète (SMTP_HOST/SMTP_USER/SMTP_PASSWORD/MAIL_FROM).");
  return cfg;
}

/** URL applicative de base (pour liens dans les emails). */
export function getAppBaseUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://staging.gedify.fr").replace(/\/+$/, "");
}
