"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { saveTemplateContent, type ResponsiveVariants } from "@/lib/saas/mailing/template-store";
import { enqueueMail, processMailQueue } from "@/lib/saas/mailing/queue";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }
async function su() { const me = await getCurrentUser(); if (!me?.is_superuser) redirect("/admin/saas/tenants"); }

function parseVariants(json: string): ResponsiveVariants | null {
  try {
    const o = JSON.parse(json) as ResponsiveVariants;
    const dev = (d: unknown) => ({ html: typeof (d as { html?: unknown })?.html === "string" ? (d as { html: string }).html : "", css: typeof (d as { css?: unknown })?.css === "string" ? (d as { css: string }).css : "" });
    return { desktop: dev(o.desktop), tablet: dev(o.tablet), mobile: dev(o.mobile) };
  } catch { return null; }
}

export async function saveTemplateContentAction(formData: FormData): Promise<void> {
  await su();
  const key = s(formData.get("key")).trim();
  const variants = parseVariants(s(formData.get("variants")));
  if (!key || !variants) redirect("/admin/saas/mailing/templates?error=1");
  await saveTemplateContent(key, { subject: s(formData.get("subject")).trim() || undefined, preheader: s(formData.get("preheader")).trim() || null, variants });
  revalidatePath(`/admin/saas/mailing/templates/${encodeURIComponent(key)}`);
  redirect(`/admin/saas/mailing/templates/${encodeURIComponent(key)}?saved=1`);
}

export async function sendTestForKeyAction(formData: FormData): Promise<void> {
  await su();
  const key = s(formData.get("key")).trim();
  const to = s(formData.get("to")).trim();
  if (!key || !to) redirect(`/admin/saas/mailing/templates/${encodeURIComponent(key)}?error=1`);
  await enqueueMail({
    to, templateKey: key, category: "system",
    vars: { recipientName: "Test", tenantName: "Espace Test", invoiceNumber: "FAC-TEST", amount: "29,00 EUR", ticketRef: "SUP-TEST", planName: "Pro", subject: "Test", bodyHtml: "<p>Test</p>" },
  });
  await processMailQueue(5);
  redirect(`/admin/saas/mailing/templates/${encodeURIComponent(key)}?test=1`);
}
