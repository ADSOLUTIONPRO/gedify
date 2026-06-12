import { AlertTriangle, Tag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { SuperAdminHero } from "@/components/admin-ui";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listPromoCodes, DISCOUNT_TYPES } from "@/lib/saas/promo-codes";
import { PLAN_IDS } from "@/lib/saas/plans";
import { createPromoFormAction, togglePromoFormAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Codes promo" },
];
const inputCls = "h-9 w-full rounded-lg border px-2 text-[13px]";

export default async function SaasPromoCodesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isMultiTenantEnabled()) {
    return (
      <PageShell>
        <PageHeader breadcrumb={breadcrumb} title="Codes promo" />
        <SectionCard icon={AlertTriangle} title="Mode mono-tenant"><p className="text-sm text-slate-600"><code className="font-mono text-[12px]">MULTI_TENANT</code> n&apos;est pas activé.</p></SectionCard>
      </PageShell>
    );
  }
  const { error } = await searchParams;
  const codes = await listPromoCodes().catch(() => []);

  return (
    <PageShell>
      <SuperAdminHero breadcrumb={breadcrumb} eyebrow="Administration SaaS" title="Codes promo" subtitle="Réductions et périodes gratuites (préparé pour Stripe coupon/promotion code)." icon={<Tag className="h-9 w-9" strokeWidth={1.9} aria-hidden="true" />} />
      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" /><span>{error}</span>
        </div>
      ) : null}

      <SectionCard icon={Tag} title="Créer un code promo">
        <form action={createPromoFormAction} className="grid gap-3 sm:grid-cols-3">
          <input name="code" required placeholder="WELCOME50" className={inputCls} style={{ borderColor: "var(--border)" }} />
          <input name="name" placeholder="Nom" className={inputCls} style={{ borderColor: "var(--border)" }} />
          <select name="discountType" defaultValue="percent" className={inputCls} style={{ borderColor: "var(--border)" }}>
            {DISCOUNT_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input name="percentOff" type="number" min={0} max={100} placeholder="% off" className={inputCls} style={{ borderColor: "var(--border)" }} />
          <input name="amountOffCents" type="number" min={0} placeholder="montant off (cents)" className={inputCls} style={{ borderColor: "var(--border)" }} />
          <select name="appliesToPlan" defaultValue="" className={inputCls} style={{ borderColor: "var(--border)" }}>
            <option value="">tous plans</option>
            {PLAN_IDS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input name="freeDurationCount" type="number" min={0} placeholder="durée gratuite" className={inputCls} style={{ borderColor: "var(--border)" }} />
          <select name="freeDurationUnit" defaultValue="" className={inputCls} style={{ borderColor: "var(--border)" }}>
            <option value="">unité</option>
            <option value="day">jours</option><option value="month">mois</option><option value="year">années</option><option value="lifetime">à vie</option>
          </select>
          <input name="maxRedemptions" type="number" min={0} placeholder="max utilisations" className={inputCls} style={{ borderColor: "var(--border)" }} />
          <button type="submit" className="h-9 rounded-lg px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Créer</button>
        </form>
      </SectionCard>

      <SectionCard icon={Tag} title={`Codes (${codes.length})`} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b text-[11px] font-semibold uppercase tracking-wide text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Remise</th>
                <th className="px-4 py-2.5">Plan</th><th className="px-4 py-2.5">Utilisations</th><th className="px-4 py-2.5">Expire</th>
                <th className="px-4 py-2.5">Actif</th><th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                  <td className="px-4 py-2.5 font-mono text-[12px]">{c.code}</td>
                  <td className="px-4 py-2.5">{c.discountType}</td>
                  <td className="px-4 py-2.5">{c.percentOff != null ? `${c.percentOff}%` : c.amountOffCents != null ? `${(c.amountOffCents / 100).toFixed(2)}€` : c.freeDurationUnit ? `${c.freeDurationCount ?? ""} ${c.freeDurationUnit}` : "—"}</td>
                  <td className="px-4 py-2.5">{c.appliesToPlan ?? "tous"}</td>
                  <td className="px-4 py-2.5">{c.redeemedCount}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}</td>
                  <td className="px-4 py-2.5">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-4 py-2.5">{c.isActive ? "Oui" : "Non"}</td>
                  <td className="px-4 py-2.5">
                    <form action={togglePromoFormAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={(!c.isActive).toString()} />
                      <button type="submit" className="rounded-lg border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: "var(--border)" }}>{c.isActive ? "Désactiver" : "Activer"}</button>
                    </form>
                  </td>
                </tr>
              ))}
              {codes.length === 0 ? <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Aucun code promo.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </PageShell>
  );
}
