import Link from "next/link";
import { AlertTriangle, LayoutGrid, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listTenants, getTenantCounts, countTenantMembers } from "@/lib/tenant/tenant-store";
import { AdminCard, AdminBadge, AdminDataTable, type AdminColumn, SuperAdminHero } from "@/components/admin-ui";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Clients / Espaces" },
];
type Tone = "neutral" | "info" | "success" | "warning" | "danger";
function statusTone(s: string | null | undefined): Tone {
  switch (s) { case "active": return "success"; case "trial": case "trialing": return "info"; case "suspended": return "danger"; case "archived": return "neutral"; default: return "neutral"; }
}
type Row = { tenant: Awaited<ReturnType<typeof listTenants>>[number]; members: number; counts: Awaited<ReturnType<typeof getTenantCounts>> | null };

export default async function SaasTenantsPage() {
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Clients / Espaces" description="Accès réservé aux superusers." /><AdminCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Cette page globale est réservée aux superusers.</p></AdminCard></PageShell>;
  }
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Clients / Espaces" /><AdminCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></AdminCard></PageShell>;
  }

  const tenants = await listTenants().catch(() => []);
  const rows: Row[] = await Promise.all(tenants.map(async (t) => ({
    tenant: t, members: await countTenantMembers(t.id).catch(() => 0), counts: await getTenantCounts(t.id).catch(() => null),
  })));

  const columns: AdminColumn<Row>[] = [
    { key: "name", header: "Nom / Slug", cell: (r) => (<><div className="font-semibold" style={{ color: "var(--au-navy)" }}>{r.tenant.name ?? r.tenant.id}</div><div className="font-mono text-[11px] text-slate-500">{r.tenant.slug}</div></>) },
    { key: "plan", header: "Plan", cell: (r) => <code className="font-mono text-[12px]">{r.tenant.plan ?? "—"}</code> },
    { key: "status", header: "Statut", cell: (r) => <AdminBadge tone={statusTone(r.tenant.status)}>{r.tenant.status ?? "—"}</AdminBadge> },
    { key: "users", header: "Users", align: "right", cell: (r) => r.members },
    { key: "docs", header: "Docs", align: "right", cell: (r) => r.counts?.documents ?? "—" },
    { key: "tags", header: "Tags", align: "right", cell: (r) => r.counts?.tags ?? "—" },
    { key: "corr", header: "Corresp.", align: "right", cell: (r) => r.counts?.correspondents ?? "—" },
    { key: "act", header: "", align: "right", cell: (r) => <Link href={`/admin/saas/tenants/${encodeURIComponent(r.tenant.id)}`} className="text-[12px] font-semibold" style={{ color: "var(--au-pink)" }}>Détails →</Link> },
  ];

  return (
    <PageShell>
      <SuperAdminHero
        breadcrumb={breadcrumb}
        eyebrow="Administration SaaS"
        title="Clients / Espaces"
        subtitle={`Vue globale (superuser) — ${tenants.length} client(s).`}
        icon={<LayoutGrid className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />}
        actions={<Link href="/admin/saas/create-tenant" className="au-btn au-btn--primary"><Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" /> Créer un client</Link>}
      />
      <AdminDataTable<Row>
        title="Clients"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.tenant.id}
        emptyTitle="Aucun client"
        emptyHint={<Link href="/admin/saas/create-tenant" style={{ color: "var(--au-pink)" }}>Créer le premier client</Link>}
      />
    </PageShell>
  );
}
