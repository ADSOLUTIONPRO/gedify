"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  createInvoiceTemplate, updateInvoiceTemplate, setDefaultInvoiceTemplate,
  duplicateInvoiceTemplate, deleteInvoiceTemplate, ensureDefaultInvoiceTemplate, type TemplateInput,
} from "@/lib/saas/billing/invoice-template-store";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
function bool(v: FormDataEntryValue | null): boolean { return s(v) === "1" || s(v) === "on"; }
async function su() { const me = await getCurrentUser(); if (!me?.is_superuser) redirect("/admin/saas/tenants"); }

function parse(formData: FormData): TemplateInput {
  return {
    name: s(formData.get("name")) || "Modèle",
    locale: s(formData.get("locale")) || "fr-FR",
    currency: s(formData.get("currency")) || "EUR",
    primaryColor: s(formData.get("primaryColor")) || "#0E7490",
    secondaryColor: s(formData.get("secondaryColor")) || null,
    fontFamily: s(formData.get("fontFamily")) || null,
    logoPosition: s(formData.get("logoPosition")) || "left",
    showLogo: bool(formData.get("showLogo")),
    showPaymentDetails: bool(formData.get("showPaymentDetails")),
    showLegalFooter: bool(formData.get("showLegalFooter")),
    showQrCode: bool(formData.get("showQrCode")),
    headerHtml: s(formData.get("headerHtml")) || null,
    footerHtml: s(formData.get("footerHtml")) || null,
    customCss: s(formData.get("customCss")) || null,
  };
}

export async function createTemplateAction(formData: FormData): Promise<void> {
  await su();
  const id = await createInvoiceTemplate(parse(formData));
  revalidatePath("/admin/saas/billing/templates");
  redirect(`/admin/saas/billing/templates/${id}?created=1`);
}

export async function updateTemplateAction(formData: FormData): Promise<void> {
  await su();
  const id = s(formData.get("id"));
  if (!id) redirect("/admin/saas/billing/templates");
  await updateInvoiceTemplate(id, parse(formData));
  revalidatePath(`/admin/saas/billing/templates/${id}`);
  redirect(`/admin/saas/billing/templates/${id}?saved=1`);
}

export async function setDefaultTemplateAction(formData: FormData): Promise<void> {
  await su();
  const id = s(formData.get("id"));
  if (id) await setDefaultInvoiceTemplate(id);
  revalidatePath("/admin/saas/billing/templates");
  redirect("/admin/saas/billing/templates?ok=default");
}

export async function duplicateTemplateAction(formData: FormData): Promise<void> {
  await su();
  const id = s(formData.get("id"));
  const copy = id ? await duplicateInvoiceTemplate(id) : null;
  revalidatePath("/admin/saas/billing/templates");
  redirect(copy ? `/admin/saas/billing/templates/${copy}?created=1` : "/admin/saas/billing/templates");
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  await su();
  const id = s(formData.get("id"));
  if (id) await deleteInvoiceTemplate(id);
  revalidatePath("/admin/saas/billing/templates");
  redirect("/admin/saas/billing/templates?ok=deleted");
}

export async function seedDefaultTemplateAction(): Promise<void> {
  await su();
  await ensureDefaultInvoiceTemplate();
  revalidatePath("/admin/saas/billing/templates");
  redirect("/admin/saas/billing/templates?ok=seeded");
}
