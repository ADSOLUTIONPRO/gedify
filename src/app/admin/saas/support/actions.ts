"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getConversation, addMessage, setStatus, assignConversation, markRead,
} from "@/lib/saas/support/conversation-store";
import { notifyAgentReply, notifyTicketResolved } from "@/lib/saas/support/notify";
import { seedDefaultSla } from "@/lib/saas/support/sla";
import { createCannedReply, deleteCannedReply } from "@/lib/saas/support/canned";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }
async function requireSuperuser() {
  const me = await getCurrentUser();
  if (!me?.is_superuser) redirect("/admin/saas/tenants");
  return me;
}

/** Réponse d'un conseiller (ou note interne, jamais visible du client). */
export async function replyAsAgentAction(formData: FormData): Promise<void> {
  const me = await requireSuperuser();
  const id = s(formData.get("conversationId"));
  const body = s(formData.get("body"));
  const isInternal = s(formData.get("isInternal")) === "1";
  const conv = await getConversation(id);
  if (!conv) redirect("/admin/saas/support");
  if (!body) redirect(`/admin/saas/support/${id}?error=` + encodeURIComponent("Message vide."));

  await addMessage({
    conversationId: id, tenantId: conv.tenantId, authorType: "agent",
    authorUserId: me.id, authorName: me.first_name || me.username, body, isInternal,
  });
  await markRead(id, "agent");
  if (!isInternal) await notifyAgentReply({ ...conv });
  revalidatePath(`/admin/saas/support/${id}`);
  redirect(`/admin/saas/support/${id}`);
}

export async function setStatusAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const id = s(formData.get("conversationId"));
  const status = s(formData.get("status"));
  const conv = await getConversation(id);
  if (!conv || !status) redirect("/admin/saas/support");
  await setStatus(id, status);
  if (status === "resolved" || status === "closed") await notifyTicketResolved({ ...conv, status });
  revalidatePath(`/admin/saas/support/${id}`);
  redirect(`/admin/saas/support/${id}?updated=1`);
}

export async function assignAction(formData: FormData): Promise<void> {
  const me = await requireSuperuser();
  const id = s(formData.get("conversationId"));
  const unassign = s(formData.get("unassign")) === "1";
  await assignConversation(id, unassign ? null : me.id);
  revalidatePath(`/admin/saas/support/${id}`);
  redirect(`/admin/saas/support/${id}?updated=1`);
}

export async function seedSlaAction(): Promise<void> {
  await requireSuperuser();
  const n = await seedDefaultSla();
  revalidatePath("/admin/saas/support/settings");
  redirect(`/admin/saas/support/settings?sla=${n}`);
}

export async function createCannedAction(formData: FormData): Promise<void> {
  const me = await requireSuperuser();
  const title = s(formData.get("title"));
  const body = s(formData.get("body"));
  if (!title || !body) redirect("/admin/saas/support/settings?error=" + encodeURIComponent("Titre et contenu requis."));
  await createCannedReply({ title, body, category: s(formData.get("category")) || null, createdByUserId: me.id });
  revalidatePath("/admin/saas/support/settings");
  redirect("/admin/saas/support/settings?canned=1");
}

export async function deleteCannedAction(formData: FormData): Promise<void> {
  await requireSuperuser();
  const id = s(formData.get("id"));
  if (id) await deleteCannedReply(id);
  revalidatePath("/admin/saas/support/settings");
  redirect("/admin/saas/support/settings?canned=1");
}
