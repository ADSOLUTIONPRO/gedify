import { Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { isStripeEnabled, getStripeMode } from "@/lib/saas/stripe/config";
import { listPlanDefinitions } from "@/lib/saas/plan-store";
import { FEATURE_CATEGORIES } from "@/lib/saas/features";

export const dynamic = "force-dynamic";

function price(cents: number | null, currency: string): string {
  return cents == null ? "—" : `${(cents / 100).toFixed(2)} ${currency}`;
}

export default async function PricingPage() {
  const plans = (await listPlanDefinitions().catch(() => [])).filter((p) => p.isPublic && p.isActive);
  const stripeOn = isStripeEnabled();
  // Quelques features clés à mettre en avant.
  const HIGHLIGHT = ["ai_enabled", "ocr_enabled", "email_import_enabled", "onlyoffice_enabled", "workflows_enabled", "api_access_enabled"];
  const labelOf = (k: string) => FEATURE_CATEGORIES.flatMap((c) => c.features).find((f) => f.key === k)?.label ?? k;

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[{ href: "/dashboard", label: "Accueil" }, { label: "Offres" }]}
        title="Offres Gedify"
        description={isMultiTenantEnabled() ? `Choisissez une offre.${stripeOn ? ` Paiement test (${getStripeMode()}).` : " (paiement bientôt disponible)"}` : "Multi-tenant non activé."}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <SectionCard key={p.code} title={p.name} description={p.description}>
            <div className="mb-3 text-[22px] font-extrabold" style={{ color: "var(--text-main)" }}>
              {price(p.monthlyPriceCents, p.currency)}<span className="text-[13px] font-normal text-slate-500"> / mois</span>
            </div>
            {p.yearlyPriceCents != null ? <div className="-mt-2 mb-3 text-[12px] text-slate-500">ou {price(p.yearlyPriceCents, p.currency)} / an</div> : null}
            <ul className="mb-4 space-y-1 text-[13px]">
              <li className="text-slate-600">{p.maxDocuments ?? "∞"} documents · {p.maxStorageMb ?? "∞"} Mo · {p.maxUsers ?? "∞"} utilisateurs</li>
              {HIGHLIGHT.map((k) => (
                <li key={k} className="flex items-center gap-2">
                  {p.features[k] ? <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} /> : <Minus className="h-3.5 w-3.5 text-slate-300" strokeWidth={2} />}
                  <span className={p.features[k] ? "text-slate-700" : "text-slate-400"}>{labelOf(k)}</span>
                </li>
              ))}
            </ul>
            {stripeOn && (p.stripeMonthlyPriceId || p.stripeYearlyPriceId) ? (
              <form action="/api/saas/stripe/checkout" method="post" className="flex items-center gap-2">
                <input type="hidden" name="plan" value={p.code} />
                <select name="period" className="h-10 rounded-lg border px-2 text-[13px]" style={{ borderColor: "var(--border)" }}>
                  <option value="monthly">Mensuel</option>
                  <option value="yearly">Annuel</option>
                </select>
                <button type="submit" className="h-10 flex-1 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Choisir</button>
              </form>
            ) : (
              <button type="button" disabled className="h-10 w-full cursor-not-allowed rounded-xl border text-[13px] font-semibold opacity-60" style={{ borderColor: "var(--border)" }}>
                {stripeOn ? "Offre non synchronisée" : "Bientôt"}
              </button>
            )}
          </SectionCard>
        ))}
        {plans.length === 0 ? <p className="text-sm text-slate-500">Aucune offre publique.</p> : null}
      </div>
    </PageShell>
  );
}
