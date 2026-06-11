import Link from "next/link";
import { AlertTriangle, Gauge } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listTenants } from "@/lib/tenant/tenant-store";
import { getTenantPlanLimits, getTenantUsage } from "@/lib/saas/quota";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Quotas & usages" },
];

function cell(used: number, limit: number | null): { text: string; over: boolean } {
  return { text: `${used} / ${limit == null ? "∞" : limit}`, over: limit != null && used > limit };
}

export default async function SaasUsagePage() {
  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Quotas & usages" />
        <SectionCard icon={AlertTriangle} title="Mode mono-tenant">
          <p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p>
        </SectionCard>
      </PageShell>
    );
  }

  const tenants = await listTenants().catch(() => []);
  const rows = await Promise.all(
    tenants.map(async (t) => ({
      tenant: t,
      limits: await getTenantPlanLimits(t.id).catch(() => null),
      usage: await getTenantUsage(t.id).catch(() => null),
    })),
  );

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Quotas & usages" description="Consommation par client : documents, stockage, utilisateurs et fonctionnalités." />
      <SectionCard icon={Gauge} title="Usage par client" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Documents</th>
                <th className="px-4 py-2.5">Stockage (Mo)</th>
                <th className="px-4 py-2.5">Utilisateurs</th>
                <th className="px-4 py-2.5">Features</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ tenant, limits, usage }) => {
                const docs = cell(usage?.documents ?? 0, limits?.maxDocuments ?? null);
                const stor = cell(usage?.storageMb ?? 0, limits?.maxStorageMb ?? null);
                const usr = cell(usage?.users ?? 0, limits?.maxUsers ?? null);
                const feats = [
                  limits?.aiEnabled ? "IA" : null, limits?.ocrEnabled ? "OCR" : null,
                  limits?.emailImportEnabled ? "Email" : null, limits?.onlyofficeEnabled ? "Office" : null,
                ].filter(Boolean).join(" · ") || "—";
                return (
                  <tr key={tenant.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/saas/tenants/${encodeURIComponent(tenant.id)}`} className="font-semibold" style={{ color: "var(--accent)" }}>
                        {tenant.name ?? tenant.id}
                      </Link>
                      <div className="font-mono text-[11px] text-slate-500">{tenant.slug}</div>
                    </td>
                    <td className="px-4 py-2.5"><code className="font-mono text-[12px]">{limits?.planId ?? tenant.plan ?? "—"}</code></td>
                    <td className="px-4 py-2.5" style={docs.over ? { color: "#B91C1C", fontWeight: 700 } : undefined}>{docs.text}</td>
                    <td className="px-4 py-2.5" style={stor.over ? { color: "#B91C1C", fontWeight: 700 } : undefined}>{stor.text}</td>
                    <td className="px-4 py-2.5" style={usr.over ? { color: "#B91C1C", fontWeight: 700 } : undefined}>{usr.text}</td>
                    <td className="px-4 py-2.5 text-[12px] text-slate-600">{feats}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Aucun client.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <p className="text-[12px] text-slate-500">CLI : <code className="font-mono">npm run saas:check-quotas</code> (exit 1 si dépassement). Stockage = best-effort (documents créés après la Phase 7).</p>
    </PageShell>
  );
}
