import Link from "next/link";
import { LifeBuoy, Send, Star } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { getConversationForTenant, listMessages } from "@/lib/saas/support/conversation-store";
import { replyAsCustomerAction, rateConversationAction } from "../actions";

export const dynamic = "force-dynamic";

function when(v: unknown): string { return v ? new Date(String(v)).toLocaleString("fr-FR") : ""; }

export default async function SupportThreadPage({ params, searchParams }: { params: Promise<{ conversationId: string }>; searchParams: Promise<Record<string, string>> }) {
  const { conversationId } = await params;
  const sp = await searchParams;
  const breadcrumb = [
    { href: "/dashboard", label: "Accueil" },
    { href: "/support", label: "Aide & support" },
    { label: conversationId.slice(0, 8) },
  ];
  const ctx = await getCurrentTenant().catch(() => null);
  if (!ctx) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Conversation" /><SectionCard icon={LifeBuoy} title="Indisponible"><p className="text-sm text-slate-600">Aucun espace actif.</p></SectionCard></PageShell>;
  }
  const conv = await getConversationForTenant(conversationId, ctx.tenantId);
  if (!conv) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Conversation introuvable" /><SectionCard icon={LifeBuoy} title="Introuvable"><p className="text-sm text-slate-600">Cette conversation n&apos;existe pas ou ne vous appartient pas.</p></SectionCard></PageShell>;
  }
  // Le client ne voit jamais les notes internes.
  const messages = await listMessages(conversationId, { includeInternal: false });
  const isClosed = conv.status === "resolved" || conv.status === "closed";

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title={conv.subject} description={`Réf. ${conv.ref} · ${conv.status}`} />
      {sp.created ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Demande créée. Un conseiller vous répondra.</div> : null}
      {sp.rated ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Merci pour votre retour !</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      <SectionCard icon={LifeBuoy} title="Conversation">
        <div className="space-y-3">
          {messages.map((m) => {
            const mine = m.authorType === "customer";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px]" style={mine ? { background: "var(--blue-600)", color: "#fff" } : { background: "#F1F5F9", color: "#1f2937" }}>
                  <div className="mb-0.5 text-[10px] font-semibold opacity-70">
                    {m.authorType === "agent" ? "Conseiller" : m.authorType === "ai" ? "Assistant" : m.authorType === "system" ? "Système" : (m.authorName ?? "Vous")} · {when(m.createdAt)}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {!isClosed ? (
        <SectionCard icon={Send} title="Répondre">
          <form action={replyAsCustomerAction} className="space-y-2">
            <input type="hidden" name="conversationId" value={conv.id} />
            <textarea name="body" required rows={4} placeholder="Votre message…" className="w-full rounded-lg border p-2 text-[13px]" style={{ borderColor: "var(--border)" }} />
            <button className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}><Send className="h-4 w-4" />Envoyer</button>
          </form>
        </SectionCard>
      ) : (
        <SectionCard icon={Star} title="Cette demande est résolue">
          {conv.ratingScore ? (
            <p className="text-sm text-slate-600">Vous avez noté cet échange {conv.ratingScore}/5. Merci !</p>
          ) : (
            <form action={rateConversationAction} className="space-y-2">
              <input type="hidden" name="conversationId" value={conv.id} />
              <label className="space-y-1 text-[12px]">
                <span className="font-semibold">Votre satisfaction</span>
                <select name="score" className="h-9 w-40 rounded-lg border px-2 text-[13px]" style={{ borderColor: "var(--border)" }} defaultValue="5">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
                </select>
              </label>
              <textarea name="comment" rows={2} placeholder="Commentaire (optionnel)" className="w-full rounded-lg border p-2 text-[13px]" style={{ borderColor: "var(--border)" }} />
              <button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Évaluer</button>
            </form>
          )}
          <div className="mt-3"><Link href="/support" className="text-[13px] font-semibold" style={{ color: "var(--blue-600)" }}>← Retour à mes demandes</Link></div>
        </SectionCard>
      )}
    </PageShell>
  );
}
