"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { upsertDefaultBillingProfile } from "@/lib/saas/billing/profile-store";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
function sn(v: FormDataEntryValue | null): string | null { const x = s(v); return x || null; }
function n(v: FormDataEntryValue | null): number | null { const x = s(v); return x ? Number(x) : null; }

export async function saveBillingProfileAction(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");
  try {
    await upsertDefaultBillingProfile({
      profileName: s(formData.get("profileName")) || "Profil principal",
      companyName: s(formData.get("companyName")),
      legalName: sn(formData.get("legalName")),
      legalForm: sn(formData.get("legalForm")),
      siren: sn(formData.get("siren")),
      siret: sn(formData.get("siret")),
      vatNumber: sn(formData.get("vatNumber")),
      rcsCity: sn(formData.get("rcsCity")),
      rcsNumber: sn(formData.get("rcsNumber")),
      shareCapital: sn(formData.get("shareCapital")),
      addressLine1: s(formData.get("addressLine1")),
      addressLine2: sn(formData.get("addressLine2")),
      postalCode: s(formData.get("postalCode")),
      city: s(formData.get("city")),
      country: s(formData.get("country")) || "France",
      email: s(formData.get("email")),
      phone: sn(formData.get("phone")),
      iban: sn(formData.get("iban")),
      bic: sn(formData.get("bic")),
      paymentTermsDays: n(formData.get("paymentTermsDays")) ?? 30,
      latePaymentRate: sn(formData.get("latePaymentRate")),
      vatRegime: s(formData.get("vatRegime")) || "standard",
      defaultVatRate: n(formData.get("defaultVatRate")),
      invoicePrefix: s(formData.get("invoicePrefix")) || "FAC",
      creditNotePrefix: s(formData.get("creditNotePrefix")) || "AVOIR",
      legalFooterHtml: sn(formData.get("legalFooterHtml")),
    });
  } catch (e) {
    redirect(`/admin/saas/billing/profile?error=${encodeURIComponent(e instanceof Error ? e.message : "Erreur")}`);
  }
  redirect("/admin/saas/billing/profile?updated=1");
}
