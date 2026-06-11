"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createManualInvoice, type InvoiceLineInput } from "@/lib/saas/billing/invoice-service";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
function euros(v: FormDataEntryValue | null): number { const n = Number(s(v).replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) : 0; }
function num(v: FormDataEntryValue | null): number { const n = Number(s(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; }

const MAX_LINES = 8;

export async function createInvoiceFormAction(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");
  const tenantId = s(formData.get("tenantId"));
  if (!tenantId) redirect("/admin/saas/billing/invoices/new?error=" + encodeURIComponent("Tenant requis."));

  const vatRaw = s(formData.get("vatRate"));
  const vatRate = vatRaw ? num(formData.get("vatRate")) : null;
  const lines: InvoiceLineInput[] = [];
  for (let i = 0; i < MAX_LINES; i++) {
    const desc = s(formData.get(`line${i}_desc`));
    if (!desc) continue;
    lines.push({
      description: desc,
      quantity: num(formData.get(`line${i}_qty`)) || 1,
      unitPriceHtCents: euros(formData.get(`line${i}_pu`)),
      vatRate,
    });
  }
  if (lines.length === 0) redirect("/admin/saas/billing/invoices/new?error=" + encodeURIComponent("Au moins une ligne requise."));

  let id: string;
  try {
    id = await createManualInvoice({
      tenantId,
      lines,
      vatRate,
      discountCents: euros(formData.get("discount")),
      periodStart: s(formData.get("periodStart")) || null,
      periodEnd: s(formData.get("periodEnd")) || null,
    });
  } catch (e) {
    redirect("/admin/saas/billing/invoices/new?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur"));
  }
  redirect(`/admin/saas/billing/invoices/${id}?created=1`);
}
