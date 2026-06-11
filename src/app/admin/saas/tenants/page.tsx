import Link from "next/link";
import { AlertTriangle, Building2, ChevronRight, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listTenants, getTenantCounts, countTenantMembers } from "@/lib/tenant/tenant-store";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/administration", label: "Administration" },
  { label: "Tenants SaaS" },
];

export default async function SaasTenantsPage() {
  // Accès STRICTEMENT superuser (un owner de tenant non-superuser est refusé).
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Tenants SaaS" description="Accès réservé aux superusers." />
        <SectionCard icon={ShieldCheck} title="Accès refusé">
          <p className="text-sm text-slate-600">Cette page globale est réservée aux superusers.</p>
        </SectionCard>
      </PageShell>
    );
  }

  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Tenants SaaS" description="Vue globale des tenants." />
        <SectionCard icon={AlertTriangle} title="Mode mono-tenant">
          <p className="text-sm text-slate-600">
            <code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé : pas de
            gestion multi-tenant sur cette instance.
          </p>
        </SectionCard>
      </PageShell>
    );
  }

  const tenants = await listTenants().catch(() => []);
  const rows = await Promise.all(
    tenants.map(async (t) => ({
      tenant: t,
      members: await countTenantMembers(t.id).catch(() => 0),
      counts: await getTenantCounts(t.id).catch(() => null),
    })),
  );

  return (
    <PageShell>
      <PageHeader
        breadcrumb={breadcrumb}
        title="Tenants SaaS"
        description={`Vue globale (superuser) — ${tenants.length} tenant(s).`}
      />

      <SectionCard icon={Building2} title="Tenants" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2.5">Nom / Slug</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5 text-right">Users</th>
                <th className="px-4 py-2.5 text-right">Docs</th>
                <th className="px-4 py-2.5 text-right">Tags</th>
                <th className="px-4 py-2.5 text-right">Corresp.</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ tenant, members, counts }) => (
                <tr key={tenant.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-900">{tenant.name ?? tenant.id}</div>
                    <div className="font-mono text-[11px] text-slate-500">{tenant.slug}</div>
                  </td>
                  <td className="px-4 py-2.5"><code className="font-mono text-[12px]">{tenant.plan ?? "—"}</code></td>
                  <td className="px-4 py-2.5">{tenant.status ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{members}</td>
                  <td className="px-4 py-2.5 text-right">{counts?.documents ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{counts?.tags ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">{counts?.correspondents ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/admin/saas/tenants/${encodeURIComponent(tenant.id)}`}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      Détails <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Aucun tenant.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </PageShell>
  );
}
