"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createTenantInvitation, resendTenantInvitation, cancelTenantInvitation } from "@/lib/saas/invitations";
import type { TenantRole } from "@/lib/tenant/types";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
async function su() { const me = await getCurrentUser(); if (!me?.is_superuser) redirect("/admin/saas/tenants"); return me; }

export async function createInvitationAction(formData: FormData): Promise<void> {
  const me = await su();
  const tenantId = s(formData.get("tenantId"));
  const email = s(formData.get("email"));
  const role = (s(formData.get("role")) || "member") as TenantRole;
  if (!tenantId || !email) redirect("/admin/saas/invitations?error=" + encodeURIComponent("Client et email requis."));
  try {
    await createTenantInvitation({
      tenantId, email, role,
      duration: s(formData.get("duration")) || "7d",
      message: s(formData.get("message")) || null,
      invitedByUserId: me.id, inviterName: me.first_name || me.username,
      sendEmail: s(formData.get("sendEmail")) !== "0",
    });
  } catch (e) {
    redirect("/admin/saas/invitations?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur"));
  }
  revalidatePath("/admin/saas/invitations");
  redirect("/admin/saas/invitations?ok=created");
}

export async function resendInvitationAction(formData: FormData): Promise<void> {
  const me = await su();
  const id = s(formData.get("id"));
  try { await resendTenantInvitation(id, me.first_name || me.username); }
  catch (e) { redirect("/admin/saas/invitations?error=" + encodeURIComponent(e instanceof Error ? e.message : "Erreur")); }
  revalidatePath("/admin/saas/invitations");
  redirect("/admin/saas/invitations?ok=resent");
}

export async function cancelInvitationAction(formData: FormData): Promise<void> {
  await su();
  const id = s(formData.get("id"));
  if (id) await cancelTenantInvitation(id);
  revalidatePath("/admin/saas/invitations");
  redirect("/admin/saas/invitations?ok=canceled");
}
