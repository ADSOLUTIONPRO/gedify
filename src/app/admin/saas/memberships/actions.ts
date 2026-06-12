"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listUsers } from "@/lib/engine/users";
import { addOrUpdateMembership, removeMembership, transferOwnership } from "@/lib/tenant/membership-admin";
import { checkUserQuota } from "@/lib/saas/quota";
import type { TenantRole } from "@/lib/tenant/types";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
async function su() { const me = await getCurrentUser(); if (!me?.is_superuser) redirect("/admin/saas/tenants"); return me; }
const ROLES = new Set(["owner", "admin", "member", "viewer"]);

export async function addMemberAction(formData: FormData): Promise<void> {
  const me = await su();
  const tenantId = s(formData.get("tenantId"));
  const email = s(formData.get("email")).toLowerCase();
  const role = s(formData.get("role")) as TenantRole;
  if (!tenantId || !email || !ROLES.has(role)) redirect("/admin/saas/memberships?error=" + encodeURIComponent("Champs requis."));
  const user = (await listUsers()).find((u) => (u.email ?? "").toLowerCase() === email || u.username.toLowerCase() === email);
  if (!user) redirect("/admin/saas/memberships?error=" + encodeURIComponent("Aucun compte avec cet email — utilisez une invitation."));
  const quota = await checkUserQuota(tenantId, 1);
  if (!quota.ok) redirect("/admin/saas/memberships?error=" + encodeURIComponent(quota.message ?? "Quota atteint."));
  await addOrUpdateMembership(tenantId, user.id, role, me.username);
  revalidatePath("/admin/saas/memberships");
  redirect("/admin/saas/memberships?ok=1");
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const me = await su();
  const tenantId = s(formData.get("tenantId"));
  const userId = Number(s(formData.get("userId")));
  const role = s(formData.get("role")) as TenantRole;
  if (!tenantId || !userId || !ROLES.has(role)) redirect("/admin/saas/memberships");
  try { await addOrUpdateMembership(tenantId, userId, role, me.username); }
  catch (e) { redirect("/admin/saas/memberships?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur")); }
  revalidatePath("/admin/saas/memberships");
  redirect("/admin/saas/memberships?ok=1");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const me = await su();
  const tenantId = s(formData.get("tenantId"));
  const userId = Number(s(formData.get("userId")));
  if (!tenantId || !userId) redirect("/admin/saas/memberships");
  try { await removeMembership(tenantId, userId, me.username); }
  catch (e) { redirect("/admin/saas/memberships?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur")); }
  revalidatePath("/admin/saas/memberships");
  redirect("/admin/saas/memberships?ok=1");
}

export async function transferOwnerAction(formData: FormData): Promise<void> {
  const me = await su();
  const tenantId = s(formData.get("tenantId"));
  const userId = Number(s(formData.get("userId")));
  if (!tenantId || !userId) redirect("/admin/saas/memberships");
  try { await transferOwnership(tenantId, userId, me.username); }
  catch (e) { redirect("/admin/saas/memberships?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur")); }
  revalidatePath("/admin/saas/memberships");
  redirect("/admin/saas/memberships?ok=1");
}
