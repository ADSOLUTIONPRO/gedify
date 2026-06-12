import { getStripeMode } from "./config";

/* Liens profonds vers le Dashboard Stripe (test vs live). On NE recrée pas
   l'admin Stripe : on ouvre directement la ressource dans Stripe. */

export function stripeDashboardBase(): string {
  return getStripeMode() === "live" ? "https://dashboard.stripe.com" : "https://dashboard.stripe.com/test";
}

function url(segment: string, id: string | null | undefined): string | null {
  if (!id) return null;
  return `${stripeDashboardBase()}/${segment}/${id}`;
}

export function stripeCustomerUrl(id: string | null | undefined): string | null { return url("customers", id); }
export function stripeSubscriptionUrl(id: string | null | undefined): string | null { return url("subscriptions", id); }
export function stripeInvoiceUrl(id: string | null | undefined): string | null { return url("invoices", id); }
export function stripePaymentUrl(id: string | null | undefined): string | null { return url("payments", id); }
export function stripeEventUrl(id: string | null | undefined): string | null { return url("events", id); }
export function stripeProductUrl(id: string | null | undefined): string | null { return url("products", id); }
