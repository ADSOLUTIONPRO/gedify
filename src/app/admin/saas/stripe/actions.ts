"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isStripeEnabled, requireStripeEnabled } from "@/lib/saas/stripe/config";
import { listPlanDefinitions } from "@/lib/saas/plan-store";
import { syncPlanToStripe } from "@/lib/saas/stripe/sync";

async function su() { const me = await getCurrentUser(); if (!me?.is_superuser) redirect("/admin/saas/tenants"); }

/** Synchronise tous les plans payants (produit + prices) avec Stripe. */
export async function syncAllPlansAction(): Promise<void> {
  await su();
  if (!isStripeEnabled()) redirect("/admin/saas/stripe?error=" + encodeURIComponent("Stripe désactivé (STRIPE_ENABLED=false)."));
  try {
    requireStripeEnabled();
    const plans = await listPlanDefinitions().catch(() => []);
    let synced = 0;
    for (const p of plans) {
      // On ne synchronise que les plans ayant au moins un tarif défini.
      if (p.monthlyPriceCents != null || p.yearlyPriceCents != null || p.stripeProductId) {
        await syncPlanToStripe(p.code);
        synced++;
      }
    }
    revalidatePath("/admin/saas/stripe");
    redirect(`/admin/saas/stripe?synced=${synced}`);
  } catch (e) {
    redirect("/admin/saas/stripe?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur de synchronisation."));
  }
}
