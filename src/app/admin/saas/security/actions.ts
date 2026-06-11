"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { markSecurityEventReviewed, logSensitiveAdminAction } from "@/lib/saas/security/security-events";
import { updateTenant } from "@/lib/tenant/tenant-admin";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
async function su() { const me = await getCurrentUser(); if (!me?.is_superuser) redirect("/admin/saas/tenants"); return me; }

export async function markReviewedAction(formData: FormData): Promise<void> {
  const me = await su();
  const id = s(formData.get("id"));
  const status = (s(formData.get("status")) || "reviewed") as "reviewed" | "ignored" | "resolved";
  if (id) await markSecurityEventReviewed(id, me.id, status);
  revalidatePath("/admin/saas/security");
  redirect("/admin/saas/security?updated=1");
}

export async function suspendTenantAction(formData: FormData): Promise<void> {
  const me = await su();
  const tenantId = s(formData.get("tenantId"));
  if (!tenantId) redirect("/admin/saas/security");
  await updateTenant(tenantId, { status: "suspended" });
  await logSensitiveAdminAction(me.id, "tenant_suspended", `Tenant ${tenantId} suspendu depuis la console sécurité`, { tenantId, category: "tenant", severity: "warning" });
  revalidatePath("/admin/saas/security");
  redirect("/admin/saas/security?updated=1");
}

export async function reactivateTenantAction(formData: FormData): Promise<void> {
  const me = await su();
  const tenantId = s(formData.get("tenantId"));
  if (!tenantId) redirect("/admin/saas/security");
  await updateTenant(tenantId, { status: "active" });
  await logSensitiveAdminAction(me.id, "tenant_reactivated", `Tenant ${tenantId} réactivé depuis la console sécurité`, { tenantId, category: "tenant" });
  revalidatePath("/admin/saas/security");
  redirect("/admin/saas/security?updated=1");
}
