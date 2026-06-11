import "server-only";

import type Stripe from "stripe";
import { getStripeMode, getStripeSecretKey, requireStripeEnabled } from "./config";

export { isStripeEnabled, requireStripeEnabled } from "./config";

/* Client Stripe — chargé PARESSEUSEMENT (import dynamique) afin que le SDK ne
   soit jamais évalué tant que Stripe n'est pas utilisé. Mis en cache. */

let cached: Stripe | null = null;

export async function getStripeClient(): Promise<Stripe> {
  requireStripeEnabled();
  if (cached) return cached;
  const { default: StripeSDK } = await import("stripe");
  cached = new StripeSDK(getStripeSecretKey() as string, {
    // Version d'API épinglée au runtime ; metadata d'environnement pour le suivi.
    appInfo: { name: "Gedify SaaS", url: "https://staging.gedify.fr" },
  });
  return cached;
}

/** Environnement transmis en metadata Stripe (staging par défaut). */
export function stripeEnvironment(): string {
  return process.env.APP_ENV?.trim() || (getStripeMode() === "live" ? "production" : "staging");
}
