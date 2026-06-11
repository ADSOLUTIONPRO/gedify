"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { seedDefaultTemplates, upsertTemplate } from "@/lib/saas/mailing/template-store";
import { processMailQueue, retryQueueItem, cancelQueueItem, enqueueMail } from "@/lib/saas/mailing/queue";
import { runPaymentReminders } from "@/lib/saas/mailing/reminders";
import { createCampaign, sendCampaign, type CampaignAudience } from "@/lib/saas/mailing/campaigns";
import { verifySmtp } from "@/lib/saas/mailing/transport";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
async function requireSuperuser() {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");
  return me;
}
function backTo(path: string, params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`${path}${q ? `?${q}` : ""}`);
}

export async function seedTemplatesAction(): Promise<void> {
  await requireSuperuser();
  const res = await seedDefaultTemplates();
  revalidatePath("/admin/saas/mailing/templates");
  backTo("/admin/saas/mailing/templates", { seeded: `${res.created}` });
}

export async function toggleTemplateAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const key = s(formData.get("key"));
  const enabled = s(formData.get("enabled")) === "1";
  if (key) await upsertTemplate(key, { enabled });
  revalidatePath("/admin/saas/mailing/templates");
  backTo("/admin/saas/mailing/templates", { updated: "1" });
}

export async function saveTemplateAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const key = s(formData.get("key"));
  if (!key) backTo("/admin/saas/mailing/templates", { error: "Clé manquante." });
  await upsertTemplate(key, {
    name: s(formData.get("name")) || undefined,
    subject: s(formData.get("subject")) || undefined,
    htmlBody: s(formData.get("htmlBody")) || undefined,
  });
  revalidatePath("/admin/saas/mailing/templates");
  backTo("/admin/saas/mailing/templates", { updated: "1" });
}

export async function processQueueAction(): Promise<void> {
  await requireSuperuser();
  const res = await processMailQueue(50);
  revalidatePath("/admin/saas/mailing/queue");
  backTo("/admin/saas/mailing/queue", res.disabled ? { disabled: "1" } : { sent: `${res.sent}`, failed: `${res.failed}` });
}

export async function runRemindersAction(): Promise<void> {
  await requireSuperuser();
  const res = await runPaymentReminders();
  revalidatePath("/admin/saas/mailing");
  backTo("/admin/saas/mailing", { reminders: `${res.enqueued}`, suspended: `${res.suspended}` });
}

export async function retryItemAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const id = s(formData.get("id"));
  if (id) await retryQueueItem(id);
  revalidatePath("/admin/saas/mailing/queue");
  backTo("/admin/saas/mailing/queue", { updated: "1" });
}

export async function cancelItemAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const id = s(formData.get("id"));
  if (id) await cancelQueueItem(id);
  revalidatePath("/admin/saas/mailing/queue");
  backTo("/admin/saas/mailing/queue", { updated: "1" });
}

export async function sendTestAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const to = s(formData.get("to"));
  if (!to) backTo("/admin/saas/mailing", { error: "Adresse requise." });
  const res = await enqueueMail({
    to,
    templateKey: "system.generic_notification",
    category: "system",
    vars: { recipientName: "", subject: "Test Gedify Mailing", bodyHtml: "<p>Ceci est un email de test du système de mailing Gedify.</p>" },
  });
  await processMailQueue(5);
  backTo("/admin/saas/mailing", { test: res.status });
}

export async function verifySmtpAction(): Promise<void> {
  await requireSuperuser();
  const res = await verifySmtp();
  backTo("/admin/saas/mailing", res.ok ? { smtp: "ok" } : { smtp: "fail" });
}

export async function createCampaignAction(formData: FormData): Promise<void> {
  const me = await requireSuperuser();
  const name = s(formData.get("name"));
  if (!name) backTo("/admin/saas/mailing/campaigns", { error: "Nom requis." });
  const scope = (s(formData.get("scope")) || "all") as CampaignAudience["scope"];
  const audience: CampaignAudience = { scope, value: s(formData.get("audienceValue")) || null };
  const templateKey = s(formData.get("templateKey")) || null;
  const id = await createCampaign({
    name,
    templateKey,
    subject: templateKey ? null : s(formData.get("subject")) || null,
    htmlBody: templateKey ? null : s(formData.get("htmlBody")) || null,
    category: s(formData.get("category")) || "marketing",
    audience,
    createdByUserId: me.id,
  });
  revalidatePath("/admin/saas/mailing/campaigns");
  backTo("/admin/saas/mailing/campaigns", { created: id });
}

export async function sendCampaignAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const id = s(formData.get("id"));
  if (!id) backTo("/admin/saas/mailing/campaigns", { error: "Campagne manquante." });
  try {
    const res = await sendCampaign(id);
    await processMailQueue(100);
    revalidatePath("/admin/saas/mailing/campaigns");
    backTo("/admin/saas/mailing/campaigns", { sent: `${res.enqueued}` });
  } catch (e) {
    backTo("/admin/saas/mailing/campaigns", { error: e instanceof Error ? e.message : "Erreur" });
  }
}
