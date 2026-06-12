import Link from "next/link";
import { AlertTriangle, Clock, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listTenants } from "@/lib/tenant/tenant-store";
import { listTrials } from "@/lib/saas/trials";
import { getTrialPolicy } from "@/lib/saas/settings";
import { PLAN_IDS } from "@/lib/saas/plans";
import { createTrialAction, extendTrialAction, convertTrialAction, cancelTrialAction, expireTrialAction, runTrialRemindersAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Périodes d'essai" },
];
const inp = "h-9 rounded-lg border px-2 text-[13px]";
const bd = { borderColor: "var(--border)" };
const STATE: Record<string, { l: string; bg: string; fg: string }> = {
  active: { l: "Actif", bg: "#DBEAFE", fg: "#1D4ED8" },
  ending_soon: { l: "Expire bientôt", bg: "#FEF3C7", fg: "#B45309" },
  expired: { l: "Expiré", bg: "#FEE2E2", fg: "#B91C1C" },
  converted: { l: "Converti", bg: "#DCFCE7", fg: "#15803D" },
  canceled: { l: "Annulé", bg: "#F1F5F9", fg: "#64748b" },
};
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }

export default async function TrialsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!isMultiTenantEnabled()) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Périodes d'essai" /><SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard></PageShell>;
  }
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="Périodes d'essai" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }

  const [trials, tenants, policy] = await Promise.all([listTrials(), listTenants().catch(() => []), getTrialPolicy()]);
  const c = (st: string) => trials.filter((t) => t.state === st).length;
  const endingSoon7 = trials.filter((t) => t.state === "active" && t.daysLeft != null && t.daysLeft <= 7).length;

  return (
    <PageShell>
      <PageHeader
        breadcrumb={breadcrumb}
        title="Périodes d'essai"
        description="Essais gratuits : suivi, relances, conversion."
        actions={<form action={runTrialRemindersAction}><button className="h-9 rounded-xl border px-4 text-[13px] font-semibold" style={bd}>Lancer relances / expirations</button></form>}
      />
      {sp.ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Essai {sp.ok}.</div> : null}
      {sp.reminders ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{sp.reminders} relance(s), {sp.expired ?? 0} expiration(s).</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Actifs" value={String(c("active") + c("ending_soon"))} />
        <StatCard label="Expirent ≤ 7j" value={String(endingSoon7)} />
        <StatCard label="Expirent ≤ 3j" value={String(c("ending_soon"))} />
        <StatCard label="Expirés" value={String(c("expired"))} />
        <StatCard label="Convertis" value={String(c("converted"))} />
      </div>

      <SectionCard icon={Plus} title="Démarrer un essai">
        <form action={createTrialAction} className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Client</span><br /><select name="tenantId" required className={inp} style={bd}>{tenants.map((t) => <option key={t.id} value={t.id}>{t.name ?? t.slug}</option>)}</select></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Plan d&apos;essai</span><br /><select name="plan" className={inp} style={bd} defaultValue={policy.defaultPlan}>{PLAN_IDS.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <label className="space-y-1 text-[12px]"><span className="font-semibold">Durée (jours)</span><br /><input name="days" type="number" defaultValue={14} className={inp} style={bd} /></label>
          <button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Démarrer</button>
        </form>
      </SectionCard>

      <SectionCard icon={Clock} title={`${trials.length} essai(s)`} bodyClassName="p-0">
        {trials.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Aucun essai.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-3 py-2">Client</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">État</th><th className="px-3 py-2">Fin</th><th className="px-3 py-2">Jours</th><th className="px-3 py-2">Actions</th>
              </tr></thead>
              <tbody>
                {trials.map((t) => {
                  const st = STATE[t.state] ?? STATE.active;
                  const live = t.status === "trialing";
                  return (
                    <tr key={t.tenantId} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="px-3 py-2"><Link href={`/admin/saas/tenants/${t.tenantId}`} style={{ color: "var(--blue-600)" }}>{t.tenantName ?? t.tenantId}</Link></td>
                      <td className="px-3 py-2">{t.plan ?? "—"}</td>
                      <td className="px-3 py-2"><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: st.bg, color: st.fg }}>{st.l}</span></td>
                      <td className="px-3 py-2 text-[11px]">{date(t.trialEnd)}</td>
                      <td className="px-3 py-2">{t.daysLeft != null ? t.daysLeft : "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {live ? (
                            <>
                              <form action={extendTrialAction}><input type="hidden" name="tenantId" value={t.tenantId} /><input type="hidden" name="days" value="7" /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={bd}>+7j</button></form>
                              <form action={extendTrialAction}><input type="hidden" name="tenantId" value={t.tenantId} /><input type="hidden" name="days" value="30" /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={bd}>+30j</button></form>
                              <form action={convertTrialAction}><input type="hidden" name="tenantId" value={t.tenantId} /><input type="hidden" name="plan" value={t.plan ?? "pro"} /><button className="h-7 rounded px-2 text-[11px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Convertir</button></form>
                              <form action={expireTrialAction}><input type="hidden" name="tenantId" value={t.tenantId} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={bd}>Expirer</button></form>
                              <form action={cancelTrialAction}><input type="hidden" name="tenantId" value={t.tenantId} /><button className="h-7 rounded border px-2 text-[11px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Annuler</button></form>
                            </>
                          ) : null}
                        </div>
                      </td>
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
