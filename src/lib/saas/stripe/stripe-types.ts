/* Types Stripe (préparation — Phase 8). Aucune dépendance au SDK Stripe : ces
   types décrivent la forme future des objets pour brancher Stripe plus tard. */

export type StripeMode = "test" | "live";

/** Mapping plan SaaS ↔ Stripe (renseigné plus tard dans SaasPlan). */
export type StripePlanMapping = {
  planCode: string;
  stripeProductId: string | null;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
};

/** Statut de configuration Stripe (présences uniquement — jamais de secret). */
export type StripeConfigStatus = {
  enabled: boolean;
  mode: StripeMode;
  secretKeyPresent: boolean;
  webhookSecretPresent: boolean;
  priceFreePresent: boolean;
  priceProPresent: boolean;
  priceBusinessPresent: boolean;
};

/** Événement webhook Stripe (forme future, traité dans payment_events). */
export type StripeWebhookEventLike = {
  id: string;
  type: string;
  created: number;
};
