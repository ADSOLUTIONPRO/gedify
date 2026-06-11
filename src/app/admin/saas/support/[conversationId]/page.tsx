import { Headset, Send, ShieldCheck, StickyNote } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getConversation, listMessages } from "@/lib/saas/support/conversation-store";
import { getTenantById } from "@/lib/tenant/tenant-store";
import { listCannedReplies } from "@/lib/saas/support/canned";
import { replyAsAgentAction, setStatusAction, assignAction } from "../actions";

export const dynamic = "force-dynamic";

function when(v: unknown): string { return v ? new Date(String(v)).toLocaleString("fr-FR") : ""; }
const AUTHOR: Record<string, string> = { customer: "Client", agent: "Conseiller", ai: "Assistant IA", system: "Système" };

export default async function AdminSupportThreadPage({ params, searchParams }: { params: Promise<{ conversationId: string }>; searchParams: Promise<Record<string, string>> }) {
  const { conversationId } = await params;
  const sp = await searchParams;
  const breadcrumb = [
    { href: "/dashboard", label: "Accueil" },
    { href: "/admin/saas/support", label: "Support" },
    { label: conversationId.slice(0, 8) },
  ];
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Conversation" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const conv = await getConversation(conversationId);
  if (!conv) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Introuvable" /><SectionCard icon={Headset} title="Introuvable"><p className="text-sm text-slate-600">Conversation inexistante.</p></SectionCard></PageShell>;
  }
  const [messages, tenant, canned] = await Promise.all([
    listMessages(conversationId, { includeInternal: true }),
    getTenantById(conv.tenantId).catch(() => null),
    listCannedReplies(),
  ]);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title={conv.subject} description={`Réf. ${conv.ref} · ${conv.channel} · priorité ${conv.priority}`} />
      {sp.updated ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Mis à jour.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      <SectionCard icon={Headset} title="Détails">
        <MetadataGrid columns={3} items={[
          { label: "Client", value: tenant?.name ?? conv.tenantId },
          { label: "Demandeur", value: conv.createdByName ?? "—" },
          { label: "Statut", value: conv.status },
          { label: "Assignée à", value: conv.assignedToUserId ? `#${conv.assignedToUserId}` : "Non assignée" },
          { label: "1re réponse", value: conv.firstResponseAt ? when(conv.firstResponseAt) : "—" },
          { label: "SLA", value: conv.slaDueAt ? (conv.firstResponseAt ? "✓ respecté" : (new Date(conv.slaDueAt) < new Date() ? "⚠️ dépassé" : `avant ${when(conv.slaDueAt)}`)) : "—" },
          { label: "Note", value: conv.ratingScore ? `${conv.ratingScore}/5` : "—" },
        ]} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <form action={assignAction}><input type="hidden" name="conversationId" value={conv.id} />{conv.assignedToUserId ? <input type="hidden" name="unassign" value="1" /> : null}<button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>{conv.assignedToUserId ? "Désassigner" : "M'assigner"}</button></form>
          {["pending", "open", "waiting_customer", "resolved", "closed"].map((st) => (
            conv.status !== st ? (
              <form key={st} action={setStatusAction}>
                <input type="hidden" name="conversationId" value={conv.id} />
                <input type="hidden" name="status" value={st} />
                <button className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>{st === "resolved" ? "Marquer résolu" : st === "closed" ? "Clôturer" : `→ ${st}`}</button>
              </form>
            ) : null
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={Headset} title="Fil de discussion">
        <div className="space-y-3">
          {messages.map((m) => {
            const fromAgent = m.authorType === "agent" || m.authorType === "ai";
            const bg = m.isInternal ? "#FEF9C3" : fromAgent ? "var(--blue-600)" : "#F1F5F9";
            const fg = m.isInternal ? "#854D0E" : fromAgent ? "#fff" : "#1f2937";
            return (
              <div key={m.id} className={`flex ${fromAgent ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px]" style={{ background: bg, color: fg }}>
                  <div className="mb-0.5 text-[10px] font-semibold opacity-80">
                    {m.isInternal ? "🔒 Note interne · " : ""}{AUTHOR[m.authorType] ?? m.authorType}{m.authorName ? ` (${m.authorName})` : ""} · {when(m.createdAt)}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard icon={Send} title="Répondre">
        <form action={replyAsAgentAction} className="space-y-2">
          <input type="hidden" name="conversationId" value={conv.id} />
          <textarea name="body" required rows={4} placeholder="Réponse au client…" className="w-full rounded-lg border p-2 text-[13px]" style={{ borderColor: "var(--border)" }} />
          <div className="flex flex-wrap items-center gap-3">
            <button name="isInternal" value="0" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}><Send className="h-4 w-4" />Envoyer au client</button>
            <button name="isInternal" value="1" className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-4 text-[13px] font-semibold" style={{ borderColor: "var(--border)" }}><StickyNote className="h-4 w-4" />Note interne</button>
          </div>
        </form>
        {canned.length > 0 ? (
          <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
            <div className="mb-1.5 text-[11px] font-bold uppercase text-slate-500">Réponses types</div>
            <div className="space-y-1.5">
              {canned.map((r) => (
                <details key={r.id} className="rounded-lg border p-2 text-[12px]" style={{ borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer font-semibold">{r.title}</summary>
                  <p className="mt-1 whitespace-pre-wrap text-slate-600">{r.body}</p>
                </details>
              ))}
            </div>
          </div>
        ) : null}
      </SectionCard>
    </PageShell>
  );
}
