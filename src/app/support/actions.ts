"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { isFeatureEnabled } from "@/lib/saas/entitlements";
import {
  createConversation, getConversation, getConversationForTenant, addMessage, rateConversation, markRead,
} from "@/lib/saas/support/conversation-store";
import { notifyTicketReceived } from "@/lib/saas/support/notify";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v.trim() : ""; }

/** Crée une demande de support pour le tenant courant. */
export async function createSupportConversationAction(formData: FormData): Promise<void> {
  const ctx = await getCurrentTenant().catch(() => null);
  if (!ctx) redirect("/support?error=" + encodeURIComponent("Aucun espace actif."));
  if (!(await isFeatureEnabled(ctx.tenantId, "human_support_enabled"))) {
    redirect("/support?error=" + encodeURIComponent("Le support humain n'est pas inclus dans votre offre."));
  }
  const subject = s(formData.get("subject"));
  const body = s(formData.get("body"));
  if (!subject || !body) redirect("/support/new?error=" + encodeURIComponent("Sujet et message requis."));
  const priority = s(formData.get("priority")) || "normal";

  const id = await createConversation({
    tenantId: ctx.tenantId, subject, body, priority,
    createdByUserId: ctx.userId, createdByName: ctx.username, channel: "ticket",
    category: s(formData.get("category")) || null,
  });
  const conv = await getConversation(id);
  if (conv) await notifyTicketReceived(conv);
  revalidatePath("/support");
  redirect(`/support/${id}?created=1`);
}

/** Réponse du client dans sa propre conversation (cloisonné par tenant). */
export async function replyAsCustomerAction(formData: FormData): Promise<void> {
  const ctx = await getCurrentTenant().catch(() => null);
  if (!ctx) redirect("/support");
  const id = s(formData.get("conversationId"));
  const body = s(formData.get("body"));
  const conv = await getConversationForTenant(id, ctx.tenantId);
  if (!conv) redirect("/support?error=" + encodeURIComponent("Conversation introuvable."));
  if (!body) redirect(`/support/${id}?error=` + encodeURIComponent("Message vide."));
  await addMessage({
    conversationId: id, tenantId: ctx.tenantId, authorType: "customer",
    authorUserId: ctx.userId, authorName: ctx.username, body,
  });
  await markRead(id, "customer");
  revalidatePath(`/support/${id}`);
  redirect(`/support/${id}`);
}

export async function rateConversationAction(formData: FormData): Promise<void> {
  const ctx = await getCurrentTenant().catch(() => null);
  if (!ctx) redirect("/support");
  const id = s(formData.get("conversationId"));
  const conv = await getConversationForTenant(id, ctx.tenantId);
  if (!conv) redirect("/support");
  const score = Number(s(formData.get("score"))) || 0;
  if (score >= 1) await rateConversation(id, score, s(formData.get("comment")) || null);
  revalidatePath(`/support/${id}`);
  redirect(`/support/${id}?rated=1`);
}
