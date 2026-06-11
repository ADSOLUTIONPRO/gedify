"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { issueInvoice, markInvoicePaid, createCreditNote, voidInvoice } from "@/lib/saas/billing/invoice-service";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }
async function su() { const me = await getCurrentUser(); if (!me?.is_superuser) redirect("/admin/saas/tenants"); }
function back(id: string, err?: string): never {
  redirect(`/admin/saas/billing/invoices/${id}${err ? `?error=${encodeURIComponent(err)}` : "?updated=1"}`);
}

export async function issueInvoiceAction(formData: FormData): Promise<void> {
  await su(); const id = s(formData.get("id"));
  try { await issueInvoice(id); } catch (e) { back(id, e instanceof Error ? e.message : "Erreur"); }
  back(id);
}
export async function markPaidAction(formData: FormData): Promise<void> {
  await su(); const id = s(formData.get("id"));
  try { await markInvoicePaid(id); } catch (e) { back(id, e instanceof Error ? e.message : "Erreur"); }
  back(id);
}
export async function voidInvoiceAction(formData: FormData): Promise<void> {
  await su(); const id = s(formData.get("id"));
  try { await voidInvoice(id); } catch (e) { back(id, e instanceof Error ? e.message : "Erreur"); }
  back(id);
}
export async function createCreditNoteAction(formData: FormData): Promise<void> {
  await su(); const id = s(formData.get("id"));
  let newId: string;
  try { newId = await createCreditNote(id); } catch (e) { back(id, e instanceof Error ? e.message : "Erreur"); }
  redirect(`/admin/saas/billing/invoices/${newId}?created=1`);
}
