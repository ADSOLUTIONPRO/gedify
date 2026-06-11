import Link from "next/link";
import { LifeBuoy, MessageSquarePlus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { isFeatureEnabled } from "@/lib/saas/entitlements";
import { listConversationsForTenant } from "@/lib/saas/support/conversation-store";

export const dynamic = "force-dynamic";

const breadcrumb = [{ href: "/dashboard", label: "Accueil" }, { label: "Aide & support" }];

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: "Ouvert", bg: "#DBEAFE", fg: "#1D4ED8" },
  pending: { label: "En attente", bg: "#FEF3C7", fg: "#B45309" },
  waiting_customer: { label: "Réponse reçue", bg: "#DCFCE7", fg: "#15803D" },
  resolved: { label: "Résolu", bg: "#F1F5F9", fg: "#475569" },
  closed: { label: "Clôturé", bg: "#F1F5F9", fg: "#475569" },
};
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleString("fr-FR") : "—"; }

export default async function SupportPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const ctx = await getCurrentTenant().catch(() => null);
  if (!ctx) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Aide & support" /><SectionCard icon={LifeBuoy} title="Aucun espace actif"><p className="text-sm text-slate-600">Sélectionnez un espace pour accéder au support.</p></SectionCard></PageShell>;
  }
  const [conversations, humanSupport] = await Promise.all([
    listConversationsForTenant(ctx.tenantId),
    isFeatureEnabled(ctx.tenantId, "human_support_enabled"),
  ]);

  return (
    <PageShell>
      <PageHeader
        breadcrumb={breadcrumb}
        title="Aide & support"
        description="Vos échanges avec notre équipe."
        actions={humanSupport ? <Link href="/support/new" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}><MessageSquarePlus className="h-4 w-4" />Nouvelle demande</Link> : undefined}
      />
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      {!humanSupport ? (
        <SectionCard icon={Sparkles} title="Assistant & centre d'aide">
          <p className="text-sm text-slate-600">Votre offre inclut l&apos;assistant IA et le centre d&apos;aide. Le support humain (conseiller) est disponible sur les offres supérieures.</p>
          <Link href="/pricing" className="mt-3 inline-block text-[13px] font-semibold" style={{ color: "var(--blue-600)" }}>Voir les offres →</Link>
        </SectionCard>
      ) : null}

      <SectionCard icon={LifeBuoy} title={`Mes demandes (${conversations.length})`} bodyClassName="p-0">
        {conversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune demande pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Réf.</th><th className="px-4 py-2">Sujet</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2">Dernier message</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {conversations.map((c) => {
                  const st = STATUS[c.status] ?? STATUS.open;
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="px-4 py-2"><code className="font-mono text-[11px]">{c.ref}</code></td>
                      <td className="px-4 py-2">
                        <Link href={`/support/${c.id}`} className="font-semibold" style={{ color: "var(--blue-600)" }}>{c.subject}</Link>
                        {c.customerUnread > 0 ? <span className="ml-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{c.customerUnread}</span> : null}
                      </td>
                      <td className="px-4 py-2"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: st.bg, color: st.fg }}>{st.label}</span></td>
                      <td className="px-4 py-2 text-[11px] text-slate-500">{date(c.lastMessageAt)}</td>
                      <td className="px-4 py-2 text-right"><Link href={`/support/${c.id}`} className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>Ouvrir →</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
