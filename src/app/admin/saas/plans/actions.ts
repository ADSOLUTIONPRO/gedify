"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { upsertPlan } from "@/lib/saas/plan-store";
import { FEATURE_KEYS } from "@/lib/saas/features";
import { syncPlanToStripe } from "@/lib/saas/stripe/sync";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = str(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
function bool(v: FormDataEntryValue | null): boolean {
  return str(v) === "on" || str(v) === "true";
}
async function requireSuperuser() {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");
}
function back(err?: string): never {
  redirect(`/admin/saas/plans${err ? `?error=${encodeURIComponent(err)}` : "?updated=1"}`);
}

/** Crée ou met à jour un plan (limites + features). SUPERUSER uniquement. */
export async function upsertPlanFormAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const features: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) features[key] = formData.get(`feature_${key}`) != null;
  try {
    await upsertPlan({
      code: str(formData.get("code")),
      name: str(formData.get("name")) || str(formData.get("code")),
      description: str(formData.get("description")),
      isActive: bool(formData.get("isActive")),
      isPublic: bool(formData.get("isPublic")),
      isDefault: bool(formData.get("isDefault")),
      sortOrder: intOrNull(formData.get("sortOrder")) ?? 0,
      monthlyPriceCents: intOrNull(formData.get("monthlyPriceCents")),
      yearlyPriceCents: intOrNull(formData.get("yearlyPriceCents")),
      maxUsers: intOrNull(formData.get("maxUsers")),
      maxDocuments: intOrNull(formData.get("maxDocuments")),
      maxStorageMb: intOrNull(formData.get("maxStorageMb")),
      supportLevel: str(formData.get("supportLevel")) || null,
      features,
    });
  } catch (e) {
    back(e instanceof Error ? e.message : "Erreur.");
  }
  back();
}

/** Synchronise un plan avec Stripe (produit + prices). SUPERUSER uniquement. */
export async function syncPlanStripeFormAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  try {
    await syncPlanToStripe(str(formData.get("code")));
  } catch (e) {
    back(e instanceof Error ? e.message : "Erreur Stripe.");
  }
  back();
}
