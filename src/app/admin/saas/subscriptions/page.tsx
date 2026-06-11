import Link from "next/link";
import { AlertTriangle, Repeat } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listTenants } from "@/lib/tenant/tenant-store";
import { listSubscriptions, SUBSCRIPTION_STATUSES } from "@/lib/saas/subscriptions";
import { createManualSubscriptionAction, setSubscriptionStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Abonnements" },
];

const selectCls = "h-9 rounded-lg border px-2 text-[13px]";

export default async function SaasSubscriptionsPage() {
  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Abonnements" />
        <SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard>
      </PageShell>
    );
  }

  const [tenants, subs] = await Promise.all([listTenants().catch(() => []), listSubscriptions().catch(() => [])]);
  const latest = new Map<string, (typeof subs)[number]>();
  for (const s of subs) if (!latest.has(s.tenantId)) latest.set(s.tenantId, s);

  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Abonnements" description="État commercial par client. Actions manuelles (provider=manual)." />
      <SectionCard icon={Repeat} title="Abonnements" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5">Période</th>
                <th className="px-4 py-2.5">Provider</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const sub = latest.get(t.id);
                return (
                  <tr key={t.id} className="border-b last:border-0 align-top" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/saas/tenants/${encodeURIComponent(t.id)}`} className="font-semibold" style={{ color: "var(--accent)" }}>{t.name ?? t.id}</Link>
                      <div className="font-mono text-[11px] text-slate-500">{t.slug}</div>
                    </td>
                    <td className="px-4 py-2.5"><code className="font-mono text-[12px]">{sub?.plan ?? t.plan ?? "—"}</code></td>
                    <td className="px-4 py-2.5"><code className="font-mono text-[12px]">{sub?.status ?? "(aucun)"}</code></td>
                    <td className="px-4 py-2.5 text-[12px] text-slate-600">
                      {sub?.currentPeriodEnd ? `→ ${new Date(sub.currentPeriodEnd).toLocaleDateString("fr-FR")}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[12px]">{sub?.provider ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {sub ? (
                        <form action={setSubscriptionStatusAction} className="flex flex-wrap items-center gap-1.5">
                          <input type="hidden" name="tenantId" value={t.id} />
                          <input type="hidden" name="redirectTo" value="/admin/saas/subscriptions" />
                          <select name="status" defaultValue={sub.status ?? "active"} className={selectCls} style={{ borderColor: "var(--border)" }}>
                            {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            <option value="__resume__">▶ reprendre</option>
                          </select>
                          <button type="submit" className="h-9 rounded-lg px-3 text-[12px] font-bold text-white" style={{ background: "var(--blue-600)" }}>OK</button>
                        </form>
                      ) : (
                        <form action={createManualSubscriptionAction} className="flex flex-wrap items-center gap-1.5">
                          <input type="hidden" name="tenantId" value={t.id} />
                          <input type="hidden" name="redirectTo" value="/admin/saas/subscriptions" />
                          <input type="hidden" name="plan" value={t.plan ?? "free"} />
                          <select name="status" defaultValue="active" className={selectCls} style={{ borderColor: "var(--border)" }}>
                            {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button type="submit" className="h-9 rounded-lg border px-3 text-[12px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>Créer</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tenants.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Aucun client.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <p className="text-[12px] text-slate-500">CLI : <code className="font-mono">npm run saas:create-manual-subscription -- --tenant=… --plan=… --status=…</code> · diagnostic <code className="font-mono">npm run saas:check-subscriptions</code>.</p>
    </PageShell>
  );
}
