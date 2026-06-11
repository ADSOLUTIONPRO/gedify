import Link from "next/link";
import { Activity, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSecurityDashboardStats, getSecurityEvents, detectSuspiciousActivity } from "@/lib/saas/security/security-events";
import { listTenants } from "@/lib/tenant/tenant-store";
import { markReviewedAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Sécurité" },
];

const SEV: Record<string, { bg: string; fg: string }> = {
  info: { bg: "#EFF6FF", fg: "#1D4ED8" },
  warning: { bg: "#FEF3C7", fg: "#B45309" },
  critical: { bg: "#FEE2E2", fg: "#B91C1C" },
};
function when(v: unknown): string { return v ? new Date(String(v)).toLocaleString("fr-FR") : "—"; }

const SEV_FILTERS = [
  { key: "", label: "Tous" },
  { key: "critical", label: "Critiques" },
  { key: "warning", label: "Avertissements" },
  { key: "info", label: "Info" },
];

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ severity?: string; status?: string; tenant?: string }> }) {
  const { severity, status, tenant } = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Sécurité" /><SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Sécurité" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }

  const [stats, events, suspicious, tenants] = await Promise.all([
    getSecurityDashboardStats(),
    getSecurityEvents({ severity: severity || undefined, status: status || undefined, tenantId: tenant || undefined, limit: 200 }),
    detectSuspiciousActivity(),
    listTenants().catch(() => []),
  ]);
  const tName = new Map(tenants.map((t) => [t.id, t.name ?? t.slug ?? t.id]));

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Console de sécurité" description="Événements de sécurité plateforme, par tenant (cloisonné). Accès superuser." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Connexions 24h" value={String(stats.loginSuccess24h)} />
        <StatCard label="Échecs login 24h" value={String(stats.loginFailed24h)} />
        <StatCard label="Alertes critiques" value={String(stats.criticalOpen)} />
        <StatCard label="À traiter" value={String(stats.openTotal)} />
        <StatCard label="Échecs login 7j" value={String(stats.loginFailed7d)} />
        <StatCard label="Tenants suspendus" value={String(stats.tenantsSuspended)} />
        <StatCard label="Cross-tenant 7j" value={String(stats.crossTenant7d)} />
        <StatCard label="Avertissements ouverts" value={String(stats.warningOpen)} />
      </div>

      {suspicious.length > 0 ? (
        <SectionCard icon={ShieldAlert} title="Alertes — IP suspectes (≥5 échecs/h)">
          <div className="flex flex-wrap gap-2">
            {suspicious.map((s) => (
              <span key={s.ip} className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{s.ip} · {s.count} échecs</span>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {SEV_FILTERS.map((f) => {
          const active = (severity ?? "") === f.key;
          const q = new URLSearchParams();
          if (f.key) q.set("severity", f.key);
          if (status) q.set("status", status);
          return <Link key={f.key} href={`/admin/saas/security${q.toString() ? `?${q}` : ""}`} className="rounded-full px-3 py-1.5 text-[12px] font-semibold" style={active ? { background: "var(--blue-600)", color: "#fff" } : { background: "var(--bg-subtle,#F1F5F9)", color: "var(--text-main)" }}>{f.label}</Link>;
        })}
        <Link href="/admin/saas/security?status=open" className="rounded-full px-3 py-1.5 text-[12px] font-semibold" style={(status === "open") ? { background: "var(--blue-600)", color: "#fff" } : { background: "var(--bg-subtle,#F1F5F9)", color: "var(--text-main)" }}>Ouverts</Link>
      </div>

      <SectionCard icon={Activity} title={`Journal de sécurité (${events.length})`} bodyClassName="p-0">
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Aucun événement.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Gravité</th><th className="px-3 py-2">Tenant</th><th className="px-3 py-2">IP</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {events.map((e) => {
                  const sev = SEV[String(e.severity)] ?? SEV.info;
                  const tid = e.tenant_id ? String(e.tenant_id) : null;
                  return (
                    <tr key={String(e.id)} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="px-3 py-2 whitespace-nowrap text-[11px] text-slate-500">{when(e.created_at)}</td>
                      <td className="px-3 py-2"><code className="font-mono text-[11px]">{String(e.event_type)}</code></td>
                      <td className="px-3 py-2"><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: sev.bg, color: sev.fg }}>{String(e.severity)}</span></td>
                      <td className="px-3 py-2">{tid ? <Link href={`/admin/saas/tenants/${tid}`} style={{ color: "var(--blue-600)" }}>{tName.get(tid) ?? tid}</Link> : "—"}</td>
                      <td className="px-3 py-2 text-[11px]">{e.ip_address ? String(e.ip_address) : "—"}</td>
                      <td className="px-3 py-2">{String(e.message)}</td>
                      <td className="px-3 py-2 text-[11px]">{String(e.status)}</td>
                      <td className="px-3 py-2 text-right">
                        {e.status === "open" ? (
                          <form action={markReviewedAction}><input type="hidden" name="id" value={String(e.id)} /><input type="hidden" name="status" value="reviewed" /><button className="h-7 rounded-lg border px-2 text-[11px] font-semibold" style={{ borderColor: "var(--border)" }}>Traiter</button></form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <p className="text-[12px] text-slate-500">
        Diagnostic complémentaire : <Link href="/admin/saas/diagnostics" style={{ color: "var(--blue-600)" }}>Diagnostics SaaS</Link> ·
        <Link href="/admin/saas/encryption" style={{ color: "var(--blue-600)" }}> Chiffrement</Link>.
      </p>
    </PageShell>
  );
}
