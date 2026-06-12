import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listTenants } from "@/lib/tenant/tenant-store";
import { getTenantPlanLimits, getTenantUsage } from "@/lib/saas/quota";
import { AdminCard, AdminBadge, AdminDataTable, type AdminColumn } from "@/components/admin-ui";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Quotas & usages" },
];

function quota(used: number, limit: number | null): { text: string; over: boolean } {
  return { text: `${used} / ${limit == null ? "∞" : limit}`, over: limit != null && used > limit };
}
function Cell({ used, limit }: { used: number; limit: number | null }) {
  const q = quota(used, limit);
  return q.over ? <AdminBadge tone="danger">{q.text}</AdminBadge> : <span>{q.text}</span>;
}
type Row = { tenant: Awaited<ReturnType<typeof listTenants>>[number]; limits: Awaited<ReturnType<typeof getTenantPlanLimits>> | null; usage: Awaited<ReturnType<typeof getTenantUsage>> | null };

export default async function SaasUsagePage() {
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Quotas & usages" /><AdminCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></AdminCard></PageShell>;
  }

  const tenants = await listTenants().catch(() => []);
  const rows: Row[] = await Promise.all(tenants.map(async (t) => ({
    tenant: t, limits: await getTenantPlanLimits(t.id).catch(() => null), usage: await getTenantUsage(t.id).catch(() => null),
  })));

  const columns: AdminColumn<Row>[] = [
    { key: "client", header: "Client", cell: (r) => (<><Link href={`/admin/saas/tenants/${encodeURIComponent(r.tenant.id)}`} className="font-semibold" style={{ color: "var(--au-pink)" }}>{r.tenant.name ?? r.tenant.id}</Link><div className="font-mono text-[11px] text-slate-500">{r.tenant.slug}</div></>) },
    { key: "plan", header: "Plan", cell: (r) => <code className="font-mono text-[12px]">{r.limits?.planId ?? r.tenant.plan ?? "—"}</code> },
    { key: "docs", header: "Documents", cell: (r) => <Cell used={r.usage?.documents ?? 0} limit={r.limits?.maxDocuments ?? null} /> },
    { key: "stor", header: "Stockage (Mo)", cell: (r) => <Cell used={r.usage?.storageMb ?? 0} limit={r.limits?.maxStorageMb ?? null} /> },
    { key: "users", header: "Utilisateurs", cell: (r) => <Cell used={r.usage?.users ?? 0} limit={r.limits?.maxUsers ?? null} /> },
    { key: "feats", header: "Features", cell: (r) => {
      const f = [r.limits?.aiEnabled ? "IA" : null, r.limits?.ocrEnabled ? "OCR" : null, r.limits?.emailImportEnabled ? "Email" : null, r.limits?.onlyofficeEnabled ? "Office" : null].filter(Boolean).join(" · ");
      return <span className="text-[12px] text-slate-600">{f || "—"}</span>;
    } },
  ];

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Quotas & usages" description="Consommation par client : documents, stockage, utilisateurs et fonctionnalités." />
      <AdminDataTable<Row> title="Usage par client" columns={columns} rows={rows} rowKey={(r) => r.tenant.id} emptyTitle="Aucun client" />
      <p className="text-[12px] text-slate-500">CLI : <code className="font-mono">npm run saas:check-quotas</code> (exit 1 si dépassement). Stockage = best-effort.</p>
    </PageShell>
  );
}
