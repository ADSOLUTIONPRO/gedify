import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSecurityDashboardStats, getSecurityEvents, detectSuspiciousActivity } from "@/lib/saas/security/security-events";
import { listTenants } from "@/lib/tenant/tenant-store";
import { AdminStats, AdminStatCard, AdminCard, AdminAlert, AdminBadge, AdminButton, AdminDataTable, type AdminColumn } from "@/components/admin-ui";
import { markReviewedAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Sécurité" },
];
type SevTone = "info" | "warning" | "danger";
const SEV_TONE: Record<string, SevTone> = { info: "info", warning: "warning", critical: "danger" };
function when(v: unknown): string { return v ? new Date(String(v)).toLocaleString("fr-FR") : "—"; }
const FILTERS = [
  { key: "", label: "Tous" }, { key: "critical", label: "Critiques" }, { key: "warning", label: "Avertissements" }, { key: "info", label: "Info" },
];

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ severity?: string; status?: string; tenant?: string }> }) {
  const { severity, status, tenant } = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Sécurité" /><AdminCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></AdminCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Sécurité" /><AdminCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></AdminCard></PageShell>;
  }

  const [stats, events, suspicious, tenants] = await Promise.all([
    getSecurityDashboardStats(),
    getSecurityEvents({ severity: severity || undefined, status: status || undefined, tenantId: tenant || undefined, limit: 200 }),
    detectSuspiciousActivity(),
    listTenants().catch(() => []),
  ]);
  const tName = new Map(tenants.map((t) => [t.id, t.name ?? t.slug ?? t.id]));

  type Ev = (typeof events)[number];
  const columns: AdminColumn<Ev>[] = [
    { key: "date", header: "Date", nowrap: true, cell: (e) => <span className="text-[11px] text-slate-500">{when(e.created_at)}</span> },
    { key: "type", header: "Type", cell: (e) => <code className="font-mono text-[11px]">{String(e.event_type)}</code> },
    { key: "sev", header: "Gravité", cell: (e) => <AdminBadge tone={SEV_TONE[String(e.severity)] ?? "info"}>{String(e.severity)}</AdminBadge> },
    { key: "tenant", header: "Tenant", cell: (e) => e.tenant_id ? <Link href={`/admin/saas/tenants/${e.tenant_id}`} style={{ color: "var(--au-blue)" }}>{tName.get(String(e.tenant_id)) ?? String(e.tenant_id)}</Link> : "—" },
    { key: "ip", header: "IP", cell: (e) => <span className="text-[11px]">{e.ip_address ? String(e.ip_address) : "—"}</span> },
    { key: "msg", header: "Message", cell: (e) => String(e.message) },
    { key: "status", header: "Statut", cell: (e) => <span className="text-[11px]">{String(e.status)}</span> },
    { key: "act", header: "", align: "right", cell: (e) => e.status === "open" ? (
      <form action={markReviewedAction}><input type="hidden" name="id" value={String(e.id)} /><input type="hidden" name="status" value="reviewed" /><AdminButton variant="secondary" sm type="submit">Traiter</AdminButton></form>
    ) : null },
  ];

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Console de sécurité" description="Événements de sécurité plateforme, par tenant (cloisonné). Accès superuser." />

      <AdminStats>
        <AdminStatCard label="Connexions 24h" value={stats.loginSuccess24h} />
        <AdminStatCard label="Échecs login 24h" value={stats.loginFailed24h} tone={stats.loginFailed24h > 0 ? "warning" : "neutral"} />
        <AdminStatCard label="Alertes critiques" value={stats.criticalOpen} tone={stats.criticalOpen > 0 ? "danger" : "neutral"} />
        <AdminStatCard label="À traiter" value={stats.openTotal} tone="accent" />
        <AdminStatCard label="Échecs login 7j" value={stats.loginFailed7d} />
        <AdminStatCard label="Tenants suspendus" value={stats.tenantsSuspended} />
        <AdminStatCard label="Cross-tenant 7j" value={stats.crossTenant7d} tone={stats.crossTenant7d > 0 ? "danger" : "neutral"} />
        <AdminStatCard label="Avertissements ouverts" value={stats.warningOpen} />
      </AdminStats>

      {suspicious.length > 0 ? (
        <AdminAlert tone="danger">IP suspectes (≥5 échecs/h) : {suspicious.map((s) => `${s.ip} (${s.count})`).join(", ")}</AdminAlert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (severity ?? "") === f.key;
          const q = new URLSearchParams(); if (f.key) q.set("severity", f.key); if (status) q.set("status", status);
          return <Link key={f.key} href={`/admin/saas/security${q.toString() ? `?${q}` : ""}`} className={`au-badge ${active ? "au-badge--accent" : "au-badge--neutral"}`} style={{ padding: "6px 12px" }}>{f.label}</Link>;
        })}
        <Link href="/admin/saas/security?status=open" className={`au-badge ${status === "open" ? "au-badge--accent" : "au-badge--neutral"}`} style={{ padding: "6px 12px" }}>Ouverts</Link>
      </div>

      <AdminDataTable<Ev>
        title={`Journal de sécurité (${events.length})`}
        columns={columns}
        rows={events}
        rowKey={(e) => String(e.id)}
        emptyTitle="Aucun événement"
      />
    </PageShell>
  );
}
