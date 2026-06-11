import "server-only";

import { readStore, STORE, type EngineUser } from "@/lib/engine/stores";
import { listTenantMembersWithUser } from "@/lib/tenant/tenant-store";
import { enqueueMail } from "@/lib/saas/mailing/queue";
import { getAppBaseUrl } from "@/lib/saas/mailing/config";
import type { SupportConversation } from "./conversation-store";

/* Notifications email liées au support (best-effort, ne bloque jamais l'action). */

async function customerContact(conv: SupportConversation): Promise<{ email: string; name: string | null } | null> {
  // 1) créateur de la conversation
  if (conv.createdByUserId != null) {
    try {
      const users = await readStore<EngineUser[]>(STORE.users, []);
      const u = users.find((x) => x.id === conv.createdByUserId);
      if (u?.email) return { email: u.email, name: conv.createdByName ?? u.username };
    } catch { /* fallback */ }
  }
  // 2) repli : contact du tenant
  try {
    const members = await listTenantMembersWithUser(conv.tenantId);
    const m = members.find((x) => x.role === "owner" && x.email) ?? members.find((x) => x.email);
    if (m?.email) return { email: m.email, name: m.username };
  } catch { /* ignore */ }
  return null;
}

export async function notifyTicketReceived(conv: SupportConversation): Promise<void> {
  try {
    const c = await customerContact(conv);
    if (!c) return;
    await enqueueMail({
      to: c.email, toName: c.name, templateKey: "support.ticket_received",
      category: "support", tenantId: conv.tenantId, dedupeKey: `support_received:${conv.id}`,
      vars: { recipientName: c.name ?? "", ticketRef: conv.ref },
    });
  } catch { /* best-effort */ }
}

export async function notifyAgentReply(conv: SupportConversation): Promise<void> {
  try {
    const c = await customerContact(conv);
    if (!c) return;
    await enqueueMail({
      to: c.email, toName: c.name, templateKey: "support.agent_reply",
      category: "support", tenantId: conv.tenantId,
      vars: {
        recipientName: c.name ?? "", ticketRef: conv.ref,
        conversationUrl: `${getAppBaseUrl()}/support/${conv.id}`,
      },
    });
  } catch { /* best-effort */ }
}

export async function notifyTicketResolved(conv: SupportConversation): Promise<void> {
  try {
    const c = await customerContact(conv);
    if (!c) return;
    await enqueueMail({
      to: c.email, toName: c.name, templateKey: "support.ticket_resolved",
      category: "support", tenantId: conv.tenantId, dedupeKey: `support_resolved:${conv.id}`,
      vars: { recipientName: c.name ?? "", ticketRef: conv.ref },
    });
  } catch { /* best-effort */ }
}
