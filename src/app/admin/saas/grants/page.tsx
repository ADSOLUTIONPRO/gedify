import Link from "next/link";
import { AlertTriangle, Gift } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { SuperAdminHero } from "@/components/admin-ui";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listGrants, isGrantActive } from "@/lib/saas/grants";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Gratuités offertes" },
];

export default async function SaasGrantsPage() {
  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Gratuités offertes" />
        <SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard>
      </PageShell>
    );
  }

  const grants = await listGrants().catch(() => []);

  return (
    <PageShell>
      <SuperAdminHero breadcrumb={breadcrumb} eyebrow="Administration SaaS" title="Gratuités offertes" subtitle="Plans offerts manuellement. L'attribution se fait depuis la fiche d'un client." icon={<Gift className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />} />
      <SectionCard icon={Gift} title={`Gratuités (${grants.length})`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2.5">Tenant</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Début</th>
                <th className="px-4 py-2.5">Fin</th>
                <th className="px-4 py-2.5">Raison</th>
                <th className="px-4 py-2.5">Par</th>
                <th className="px-4 py-2.5">Statut</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => {
                const active = isGrantActive(g);
                return (
                  <tr key={g.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/saas/tenants/${encodeURIComponent(g.tenantId)}`} style={{ color: "var(--accent)" }} className="font-mono text-[12px]">{g.tenantId}</Link>
                    </td>
                    <td className="px-4 py-2.5"><code className="font-mono text-[12px]">{g.planCode}</code></td>
                    <td className="px-4 py-2.5">{g.grantType}</td>
                    <td className="px-4 py-2.5">{g.startsAt ? new Date(g.startsAt).toLocaleDateString("fr-FR") : "—"}</td>
                    <td className="px-4 py-2.5">{g.durationUnit === "lifetime" || !g.endsAt ? "à vie" : new Date(g.endsAt).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-2.5 text-[12px] text-slate-600">{g.reason ?? "—"}</td>
                    <td className="px-4 py-2.5">{g.grantedByUserId ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span style={{ color: active ? "#15803D" : "#94A3B8", fontWeight: 700 }}>{active ? "actif" : g.isActive ? "expiré" : "révoqué"}</span>
                    </td>
                  </tr>
                );
              })}
              {grants.length === 0 ? <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Aucune gratuité.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </PageShell>
  );
}
