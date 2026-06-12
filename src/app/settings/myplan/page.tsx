import Link from "next/link";
import { CreditCard, Gauge, Sparkles } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { SettingsSubPage } from "@/components/settings/settings-ui";
import { requireTenantMember } from "@/lib/auth/guards";
import { getTenantEntitlements } from "@/lib/saas/entitlements";
import { getTenantPlanLimits, getTenantUsage } from "@/lib/saas/quota";
import { getTenantSubscription, getTenantInvoices } from "@/lib/saas/subscriptions";
import { getTrialStatus } from "@/lib/saas/trials";
import { isStripeEnabled } from "@/lib/saas/stripe/config";
import { getTenantStripeCustomerId } from "@/lib/saas/stripe/sync";

export const dynamic = "force-dynamic";

function money(c: unknown, cur: unknown): string { return c == null ? "—" : `${(Number(c) / 100).toFixed(2)} ${String(cur ?? "EUR").toUpperCase()}`; }
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }
const lim = (used: number | undefined, limit: number | null | undefined) => `${used ?? 0} / ${limit == null ? "∞" : limit}`;

export default async function MyPlanPage() {
  const ctx = await requireTenantMember();
  const [ent, limits, usage, sub, invoices, trial, stripeCustomer] = await Promise.all([
    getTenantEntitlements(ctx.tenantId).catch(() => null),
    getTenantPlanLimits(ctx.tenantId).catch(() => ({ maxUsers: null, maxDocuments: null, maxStorageMb: null })),
    getTenantUsage(ctx.tenantId).catch(() => ({ users: 0, documents: 0, storageMb: 0 })),
    getTenantSubscription(ctx.tenantId).catch(() => null),
    getTenantInvoices(ctx.tenantId).catch(() => []),
    getTrialStatus(ctx.tenantId).catch(() => ({ state: "none", planCode: null, trialEnd: null, daysLeft: null })),
    isStripeEnabled() ? getTenantStripeCustomerId(ctx.tenantId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <SettingsSubPage title="Mon offre" subtitle="Votre plan, vos quotas et vos factures.">
      <SectionCard icon={Sparkles} title="Offre & abonnement">
        <MetadataGrid columns={3} items={[
          { label: "Plan effectif", value: ent?.plan.name ?? ent?.planCode ?? "—" },
          { label: "Source", value: ent?.source ?? "—" },
          { label: "Statut abonnement", value: sub?.status ?? "—" },
          { label: "Essai", value: trial.state === "none" ? "—" : `${trial.state}${trial.daysLeft != null ? ` (${trial.daysLeft} j)` : ""}` },
          { label: "Échéance", value: date(sub?.currentPeriodEnd) },
          { label: "Gratuité active", value: ent?.grant ? "Oui" : "Non" },
        ]} />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/pricing" className="h-9 rounded-xl px-4 text-[13px] font-bold leading-9 text-white" style={{ background: "var(--accent)" }}>Changer d&apos;offre</Link>
          {isStripeEnabled() && stripeCustomer ? (
            <form action="/api/saas/stripe/portal" method="post"><button className="h-9 rounded-xl border px-4 text-[13px] font-semibold" style={{ borderColor: "var(--border)" }}>Gérer mon abonnement (Stripe)</button></form>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard icon={Gauge} title="Quotas & usage">
        <MetadataGrid columns={3} items={[
          { label: "Utilisateurs", value: lim(usage.users, limits.maxUsers) },
          { label: "Documents", value: lim(usage.documents, limits.maxDocuments) },
          { label: "Stockage (Mo)", value: lim(usage.storageMb, limits.maxStorageMb) },
        ]} />
      </SectionCard>

      <SectionCard icon={CreditCard} title={`Factures (${invoices.length})`} bodyClassName="p-0">
        {invoices.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Aucune facture.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-3 py-2">Statut</th><th className="px-3 py-2 text-right">Dû</th><th className="px-3 py-2 text-right">Payé</th><th className="px-3 py-2">Date</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-3 py-2">{i.status ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{money(i.amountDue, i.currency)}</td>
                    <td className="px-3 py-2 text-right">{money(i.amountPaid, i.currency)}</td>
                    <td className="px-3 py-2 text-[11px]">{date(i.createdAt)}</td>
                    <td className="px-3 py-2 text-right">{i.hostedInvoiceUrl ? <a href={i.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>Voir ↗</a> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-3 py-2 text-[12px] text-slate-500">Factures détaillées : <Link href="/settings/billing" style={{ color: "var(--accent)" }}>Mes factures</Link>.</p>
      </SectionCard>
    </SettingsSubPage>
  );
}
