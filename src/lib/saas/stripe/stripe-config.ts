import "server-only";

import type { StripeConfigStatus, StripeMode } from "./stripe-types";

/* ────────────────────────────────────────────────────────────────────────
   Configuration Stripe — PRÉPARATION. Aucun appel réseau Stripe ici. Tant que
   STRIPE_ENABLED n'est pas vrai, rien ne doit appeler Stripe.

   Variables d'env prévues :
     STRIPE_ENABLED=false
     STRIPE_SECRET_KEY=
     STRIPE_WEBHOOK_SECRET=
     STRIPE_PRICE_FREE= / STRIPE_PRICE_PRO= / STRIPE_PRICE_BUSINESS=
     STRIPE_MODE=test
   ──────────────────────────────────────────────────────────────────────── */

export function isStripeEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test((process.env.STRIPE_ENABLED ?? "").trim());
}

export function getStripeMode(): StripeMode {
  return (process.env.STRIPE_MODE ?? "").trim().toLowerCase() === "live" ? "live" : "test";
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

/** À appeler avant toute opération Stripe future. Lève si Stripe désactivé. */
export function assertStripeEnabled(): void {
  if (!isStripeEnabled()) {
    throw new Error("Stripe n'est pas activé (STRIPE_ENABLED=false).");
  }
}
