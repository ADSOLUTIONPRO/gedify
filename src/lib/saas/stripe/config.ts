import "server-only";

import type { StripeConfigStatus, StripeMode } from "./stripe-types";

/* ────────────────────────────────────────────────────────────────────────
   Configuration Stripe (Phase 9). AUCUN appel réseau ici. Tant que
   STRIPE_ENABLED n'est pas vrai, aucune opération Stripe ne doit être tentée.

   Env :
     STRIPE_ENABLED=false
     STRIPE_MODE=test
     STRIPE_SECRET_KEY=
     STRIPE_WEBHOOK_SECRET=
     STRIPE_SUCCESS_URL=https://staging.gedify.fr/billing/success
     STRIPE_CANCEL_URL=https://staging.gedify.fr/billing/cancel
   ──────────────────────────────────────────────────────────────────────── */

export function isStripeEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test((process.env.STRIPE_ENABLED ?? "").trim());
}

export function getStripeMode(): StripeMode {
  return (process.env.STRIPE_MODE ?? "").trim().toLowerCase() === "live" ? "live" : "test";
}

export function getStripeSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}
export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}
export function getStripeSuccessUrl(): string {
  return process.env.STRIPE_SUCCESS_URL?.trim() || "https://staging.gedify.fr/billing/success";
}
export function getStripeCancelUrl(): string {
  return process.env.STRIPE_CANCEL_URL?.trim() || "https://staging.gedify.fr/billing/cancel";
}

/** Statut de config (présences uniquement — JAMAIS la valeur d'un secret). */
export function getStripeConfigStatus(): StripeConfigStatus {
  const has = (k: string) => Boolean(process.env[k]?.trim());
  return {
    enabled: isStripeEnabled(),
    mode: getStripeMode(),
    secretKeyPresent: has("STRIPE_SECRET_KEY"),
    webhookSecretPresent: has("STRIPE_WEBHOOK_SECRET"),
    priceFreePresent: has("STRIPE_PRICE_FREE"),
    priceProPresent: has("STRIPE_PRICE_PRO"),
    priceBusinessPresent: has("STRIPE_PRICE_BUSINESS"),
  };
}

/** À appeler avant toute opération Stripe. Lève si désactivé ou clé absente. */
export function requireStripeEnabled(): void {
  if (!isStripeEnabled()) throw new Error("Stripe n'est pas activé (STRIPE_ENABLED=false).");
  if (!getStripeSecretKey()) throw new Error("STRIPE_SECRET_KEY manquante.");
  if (getStripeMode() === "live") throw new Error("STRIPE_MODE=live interdit en staging (test uniquement).");
}
