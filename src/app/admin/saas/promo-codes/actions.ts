"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createPromoCode, setPromoActive } from "@/lib/saas/promo-codes";

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = str(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
async function requireSuperuser() {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");
}
function back(err?: string): never {
  redirect(`/admin/saas/promo-codes${err ? `?error=${encodeURIComponent(err)}` : "?updated=1"}`);
}

export async function createPromoFormAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  try {
    await createPromoCode({
      code: str(formData.get("code")),
      name: str(formData.get("name")),
      discountType: str(formData.get("discountType")) || "percent",
      percentOff: intOrNull(formData.get("percentOff")),
      amountOffCents: intOrNull(formData.get("amountOffCents")),
      freeDurationCount: intOrNull(formData.get("freeDurationCount")),
      freeDurationUnit: str(formData.get("freeDurationUnit")) || null,
      appliesToPlan: str(formData.get("appliesToPlan")) || null,
      maxRedemptions: intOrNull(formData.get("maxRedemptions")),
      expiresAt: str(formData.get("expiresAt")) || null,
    });
  } catch (e) {
    back(e instanceof Error ? e.message : "Erreur.");
  }
  back();
}

export async function togglePromoFormAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  try {
    await setPromoActive(str(formData.get("id")), str(formData.get("active")) === "true");
  } catch (e) {
    back(e instanceof Error ? e.message : "Erreur.");
  }
  back();
}
