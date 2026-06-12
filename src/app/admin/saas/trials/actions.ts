"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createTrial, extendTrial, cancelTrial, convertTrialToSubscription, expireTrial, runTrialReminders } from "@/lib/saas/trials";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
async function su() { const me = await getCurrentUser(); if (!me?.is_superuser) redirect("/admin/saas/tenants"); return me; }
function back(p: Record<string, string> = {}): never { redirect(`/admin/saas/trials${Object.keys(p).length ? `?${new URLSearchParams(p)}` : ""}`); }

export async function createTrialAction(formData: FormData): Promise<void> {
  const me = await su();
  const tenantId = s(formData.get("tenantId"));
  const plan = s(formData.get("plan")) || "pro";
  const days = Math.max(1, Number(s(formData.get("days"))) || 14);
  if (!tenantId) back({ error: "Client requis." });
  try { await createTrial(tenantId, plan, days, me.username); } catch (e) { back({ error: e instanceof Error ? e.message : "Erreur" }); }
  revalidatePath("/admin/saas/trials"); back({ ok: "created" });
}

export async function extendTrialAction(formData: FormData): Promise<void> {
  const me = await su();
  const tenantId = s(formData.get("tenantId"));
  const days = Math.max(1, Number(s(formData.get("days"))) || 7);
  try { await extendTrial(tenantId, days, me.username); } catch (e) { back({ error: e instanceof Error ? e.message : "Erreur" }); }
  revalidatePath("/admin/saas/trials"); back({ ok: "extended" });
}

export async function convertTrialAction(formData: FormData): Promise<void> {
  const me = await su();
  const tenantId = s(formData.get("tenantId"));
  const plan = s(formData.get("plan")) || "pro";
  try { await convertTrialToSubscription(tenantId, plan, me.username); } catch (e) { back({ error: e instanceof Error ? e.message : "Erreur" }); }
  revalidatePath("/admin/saas/trials"); back({ ok: "converted" });
}

export async function cancelTrialAction(formData: FormData): Promise<void> {
  const me = await su();
  await cancelTrial(s(formData.get("tenantId")), me.username);
  revalidatePath("/admin/saas/trials"); back({ ok: "canceled" });
}

export async function expireTrialAction(formData: FormData): Promise<void> {
  const me = await su();
  await expireTrial(s(formData.get("tenantId")), me.username);
  revalidatePath("/admin/saas/trials"); back({ ok: "expired" });
}

export async function runTrialRemindersAction(): Promise<void> {
  await su();
  const res = await runTrialReminders();
  revalidatePath("/admin/saas/trials"); back({ reminders: String(res.reminders), expired: String(res.expired) });
}
