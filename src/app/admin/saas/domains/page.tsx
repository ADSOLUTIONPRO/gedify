import Link from "next/link";
import { AlertTriangle, Globe, Link2, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SuperAdminHero } from "@/components/admin-ui";
import { SectionCard } from "@/components/ui/section-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listDomains } from "@/lib/saas/domains/domain-store";
import { getSaasSettings } from "@/lib/saas/settings";
import { listTenants } from "@/lib/tenant/tenant-store";
import { createDomainAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Domaines" },
];
const inp = "h-9 w-full rounded-lg border px-2 text-[13px]";
const bd = { borderColor: "var(--border)" };
const STATUS: Record<string, { bg: string; fg: string }> = {
  active: { bg: "#DCFCE7", fg: "#15803D" }, pending: { bg: "#FEF3C7", fg: "#B45309" },
  failed: { bg: "#FEE2E2", fg: "#B91C1C" }, disabled: { bg: "#F1F5F9", fg: "#64748b" },
};
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }

export default async function DomainsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Domaines" /><SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Domaines" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }

  const [domains, tenants, settings] = await Promise.all([listDomains(), listTenants().catch(() => []), getSaasSettings()]);
  const tName = new Map(tenants.map((t) => [t.id, t.name ?? t.slug ?? t.id]));

  return (
    <PageShell>
      <SuperAdminHero breadcrumb={breadcrumb} eyebrow="Administration SaaS" title="Domaines clients" subtitle={`Sous-domaines *.${settings.urls.primaryDomain} et domaines personnalisés.`} icon={<Link2 className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />} />
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}
      {sp.deleted ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Domaine supprimé.</div> : null}

      {!settings.urls.subdomainsEnabled && !settings.urls.customDomainsEnabled ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Sous-domaines et domaines personnalisés sont désactivés dans <Link href="/admin/saas/settings" className="font-semibold underline">Paramètres SaaS</Link>. Vous pouvez créer des entrées mais elles ne serviront pas tant que ce n&apos;est pas activé.</span>
        </div>
      ) : null}

      <SectionCard icon={Plus} title="Ajouter un domaine">
        <form action={createDomainAction} className="grid gap-3 sm:grid-cols-4">
          <label className="space-y-1 text-[12px] sm:col-span-1">
            <span className="font-semibold">Client</span>
            <select name="tenantId" required className={inp} style={bd}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name ?? t.slug}</option>)}</select>
          </label>
          <label className="space-y-1 text-[12px]">
            <span className="font-semibold">Type</span>
            <select name="type" className={inp} style={bd}><option value="subdomain">Sous-domaine Gedify</option><option value="custom_domain">Domaine personnalisé</option></select>
          </label>
          <label className="space-y-1 text-[12px]">
            <span className="font-semibold">Sous-domaine</span>
            <div className="flex items-center gap-1">
              <input name="label" placeholder="client" className={inp} style={bd} />
              <span className="text-[12px] text-slate-500">.{settings.urls.primaryDomain}</span>
            </div>
          </label>
          <label className="space-y-1 text-[12px]">
            <span className="font-semibold">Domaine personnalisé</span>
            <input name="domain" placeholder="ged.client.fr" className={inp} style={bd} />
          </label>
          <div className="sm:col-span-4"><button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Ajouter</button></div>
        </form>
      </SectionCard>

      <SectionCard icon={Globe} title={`${domains.length} domaine(s)`} bodyClassName="p-0">
        {domains.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Aucun domaine.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-3 py-2">Domaine</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">DNS</th><th className="px-3 py-2">SSL</th><th className="px-3 py-2">Principal</th><th className="px-3 py-2">Vérifié</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {domains.map((d) => {
                  const st = STATUS[d.status] ?? STATUS.pending;
                  return (
                    <tr key={d.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="px-3 py-2"><Link href={`/admin/saas/domains/${d.id}`} className="font-semibold" style={{ color: "var(--blue-600)" }}>{d.domain}</Link></td>
                      <td className="px-3 py-2">{tName.get(d.tenantId) ?? d.tenantId}</td>
                      <td className="px-3 py-2">{d.type === "subdomain" ? "Sous-domaine" : "Personnalisé"}</td>
                      <td className="px-3 py-2"><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: st.bg, color: st.fg }}>{d.status}</span></td>
                      <td className="px-3 py-2 text-[11px]">{d.dnsStatus}</td>
                      <td className="px-3 py-2 text-[11px]">{d.sslStatus}</td>
                      <td className="px-3 py-2">{d.isPrimary ? "★" : "—"}</td>
                      <td className="px-3 py-2 text-[11px]">{d.verificationStatus === "verified" ? "✓" : date(d.verifiedAt)}</td>
                      <td className="px-3 py-2 text-right"><Link href={`/admin/saas/domains/${d.id}`} className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>Gérer →</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <p className="text-[12px] text-slate-500"><Link2 className="mr-1 inline h-3.5 w-3.5" />Le SSL est géré par le reverse-proxy (Coolify/Traefik) ; le statut affiché est indicatif.</p>
    </PageShell>
  );
}
