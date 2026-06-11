import Link from "next/link";
import { AlertTriangle, Headset, Settings2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listAllConversations, getSupportStats } from "@/lib/saas/support/conversation-store";
import { listTenants } from "@/lib/tenant/tenant-store";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Support" },
];

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: "Ouvert", bg: "#DBEAFE", fg: "#1D4ED8" },
  pending: { label: "À traiter", bg: "#FEF3C7", fg: "#B45309" },
  waiting_customer: { label: "Attente client", bg: "#E0E7FF", fg: "#4338CA" },
  resolved: { label: "Résolu", bg: "#DCFCE7", fg: "#15803D" },
  closed: { label: "Clôturé", bg: "#F1F5F9", fg: "#475569" },
};
const PRIO: Record<string, string> = { urgent: "🔴 Urgent", high: "🟠 Haute", normal: "🔵 Normale", low: "⚪ Basse" };
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleString("fr-FR") : "—"; }

const FILTERS = [
  { key: "", label: "Toutes" },
  { key: "pending", label: "À traiter" },
  { key: "open", label: "Ouvertes" },
  { key: "waiting_customer", label: "Attente client" },
  { key: "resolved", label: "Résolues" },
];

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Support" /><SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Support" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }

  const [stats, conversations, tenants] = await Promise.all([
    getSupportStats(),
    listAllConversations(status || undefined),
    listTenants().catch(() => []),
  ]);
  const tName = new Map(tenants.map((t) => [t.id, t.name ?? t.slug ?? t.id]));

  return (
    <PageShell>
      <PageHeader
        breadcrumb={breadcrumb}
        title="Support clients"
        description="Conversations de support, par espace client (cloisonnées)."
        actions={<Link href="/admin/saas/support/settings" className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-4 text-[13px] font-semibold" style={{ borderColor: "var(--border)" }}><Settings2 className="h-4 w-4" />Réglages</Link>}
      />

      <SectionCard icon={Headset} title="Vue d'ensemble">
        <MetadataGrid columns={4} items={[
          { label: "À traiter", value: String(stats.pending) },
          { label: "Ouvertes", value: String(stats.open) },
          { label: "Non assignées", value: String(stats.unassigned) },
          { label: "SLA dépassé", value: String(stats.breached) },
          { label: "Attente client", value: String(stats.waiting) },
          { label: "Résolues", value: String(stats.resolved) },
          { label: "Total", value: String(stats.total) },
        ]} />
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (status ?? "") === f.key;
          return (
            <Link key={f.key} href={f.key ? `/admin/saas/support?status=${f.key}` : "/admin/saas/support"} className="rounded-full px-3 py-1.5 text-[12px] font-semibold" style={active ? { background: "var(--blue-600)", color: "#fff" } : { background: "var(--bg-subtle, #F1F5F9)", color: "var(--text-main)" }}>{f.label}</Link>
          );
        })}
      </div>

      <SectionCard icon={Headset} title={`${conversations.length} conversation(s)`} bodyClassName="p-0">
        {conversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune conversation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Réf.</th><th className="px-4 py-2">Client</th><th className="px-4 py-2">Sujet</th><th className="px-4 py-2">Priorité</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2">Dernier msg</th>
              </tr></thead>
              <tbody>
                {conversations.map((c) => {
                  const st = STATUS[c.status] ?? STATUS.open;
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="px-4 py-2"><code className="font-mono text-[11px]">{c.ref}</code></td>
                      <td className="px-4 py-2 text-[12px]">{tName.get(c.tenantId) ?? c.tenantId}</td>
                      <td className="px-4 py-2">
                        <Link href={`/admin/saas/support/${c.id}`} className="font-semibold" style={{ color: "var(--blue-600)" }}>{c.subject}</Link>
                        {c.agentUnread > 0 ? <span className="ml-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{c.agentUnread}</span> : null}
                      </td>
                      <td className="px-4 py-2 text-[12px]">{PRIO[c.priority] ?? c.priority}</td>
                      <td className="px-4 py-2"><span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: st.bg, color: st.fg }}>{st.label}</span></td>
                      <td className="px-4 py-2 text-[11px] text-slate-500">{date(c.lastMessageAt)}</td>
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
