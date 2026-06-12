"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { canManageTenantMembers, assignableRoles, canChangeTenantRole, canRemoveTenantMember } from "@/lib/tenant/permissions";
import { listTenantMembersWithUser } from "@/lib/tenant/tenant-store";
import { addOrUpdateMembership, removeMembership } from "@/lib/tenant/membership-admin";
import { createTenantInvitation, resendTenantInvitation, cancelTenantInvitation } from "@/lib/saas/invitations";
import type { TenantRole } from "@/lib/tenant/types";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }

/** Contexte tenant + garde « peut gérer les membres ». tenantId vient TOUJOURS
    du contexte serveur, jamais du formulaire (anti cross-tenant). */
async function requireManager() {
  const ctx = await getCurrentTenant().catch(() => null);
  if (!ctx) redirect("/dashboard");
  if (!canManageTenantMembers(ctx.role)) redirect("/settings/team?error=" + encodeURIComponent("Vous n'avez pas les droits pour gérer les membres."));
  return ctx;
}

export async function inviteMemberAction(formData: FormData): Promise<void> {
  const ctx = await requireManager();
  const email = s(formData.get("email"));
  const role = (s(formData.get("role")) || "member") as TenantRole;
  if (!assignableRoles(ctx.role).includes(role)) redirect("/settings/team?error=" + encodeURIComponent("Rôle non autorisé."));
  try {
    await createTenantInvitation({
      tenantId: ctx.tenantId, email, role, duration: s(formData.get("duration")) || "7d",
      invitedByUserId: ctx.userId, inviterName: ctx.username,
    });
  } catch (e) {
    redirect("/settings/team?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur"));
  }
  revalidatePath("/settings/team");
  redirect("/settings/team?ok=invited");
}

export async function changeMemberRoleAction(formData: FormData): Promise<void> {
  const ctx = await requireManager();
  const userId = Number(s(formData.get("userId")));
  const role = (s(formData.get("role")) || "member") as TenantRole;
  const members = await listTenantMembersWithUser(ctx.tenantId);
  const target = members.find((m) => m.userId === userId);
  if (!target) redirect("/settings/team");
  if (!canChangeTenantRole(ctx.role, target.role, role)) redirect("/settings/team?error=" + encodeURIComponent("Changement de rôle non autorisé."));
  try { await addOrUpdateMembership(ctx.tenantId, userId, role, ctx.username); }
  catch (e) { redirect("/settings/team?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur")); }
  revalidatePath("/settings/team");
  redirect("/settings/team?ok=role");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const ctx = await requireManager();
  const userId = Number(s(formData.get("userId")));
  if (userId === ctx.userId) redirect("/settings/team?error=" + encodeURIComponent("Vous ne pouvez pas vous retirer vous-même."));
  const members = await listTenantMembersWithUser(ctx.tenantId);
  const target = members.find((m) => m.userId === userId);
  if (!target) redirect("/settings/team");
  if (!canRemoveTenantMember(ctx.role, target.role)) redirect("/settings/team?error=" + encodeURIComponent("Retrait non autorisé."));
  try { await removeMembership(ctx.tenantId, userId, ctx.username); }
  catch (e) { redirect("/settings/team?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur")); }
  revalidatePath("/settings/team");
  redirect("/settings/team?ok=removed");
}

export async function resendInviteAction(formData: FormData): Promise<void> {
  const ctx = await requireManager();
  const id = s(formData.get("id"));
  // Vérifie que l'invitation appartient bien au tenant courant.
  const { getInvitationsForTenant } = await import("@/lib/saas/invitations");
  const mine = (await getInvitationsForTenant(ctx.tenantId)).some((i) => i.id === id);
  if (!mine) redirect("/settings/team");
  try { await resendTenantInvitation(id, ctx.username); } catch { /* ignore */ }
  redirect("/settings/team?ok=resent");
}

export async function cancelInviteAction(formData: FormData): Promise<void> {
  const ctx = await requireManager();
  const id = s(formData.get("id"));
  const { getInvitationsForTenant } = await import("@/lib/saas/invitations");
  const mine = (await getInvitationsForTenant(ctx.tenantId)).some((i) => i.id === id);
  if (!mine) redirect("/settings/team");
  await cancelTenantInvitation(id);
  redirect("/settings/team?ok=canceled");
}
