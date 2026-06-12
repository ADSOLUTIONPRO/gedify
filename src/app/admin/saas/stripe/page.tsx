import Link from "next/link";
import { Banknote, ExternalLink, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { getStripeConfigStatus } from "@/lib/saas/stripe/config";
import { stripeCustomerUrl, stripeSubscriptionUrl, stripeInvoiceUrl, stripeDashboardBase } from "@/lib/saas/stripe/links";
import { getAppBaseUrl } from "@/lib/saas/mailing/config";
import { postgresActive } from "@/lib/db/pg-store";
import { getPool } from "@/lib/db/pg";
import { syncAllPlansAction } from "./actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Stripe" },
];

function yn(v: boolean): string { return v ? "Oui" : "Non"; }
function money(cents: unknown, cur: unknown): string {
  if (cents == null) return "—";
  return `${(Number(cents) / 100).toFixed(2)} ${String(cur ?? "EUR").toUpperCase()}`;
}
function date(v: unknown): string { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }

function OpenIn({ url, label = "Ouvrir dans Stripe" }: { url: string | null; label?: string }) {
  if (!url) return <span className="text-[11px] text-slate-400">—</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: "var(--blue-600)" }}>
      {label} <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

async function mirror() {
  const empty = { counts: { plans: 0, customers: 0, subscriptions: 0 }, subs: [] as Record<string, unknown>[], invoices: [] as Record<string, unknown>[] };
  if (!postgresActive()) return empty;
  const pool = await getPool();
  const one = async (sql: string) => { try { return Number((await pool.query(sql)).rows[0]?.n ?? 0); } catch { return 0; } };
  const rows = async (sql: string) => { try { return (await pool.query(sql)).rows as Record<string, unknown>[]; } catch { return []; } };
  return {
    counts: {
      plans: await one("SELECT COUNT(*)::int n FROM saas_plans WHERE stripe_product_id IS NOT NULL"),
      customers: await one("SELECT COUNT(DISTINCT provider_customer_id)::int n FROM subscriptions WHERE provider='stripe' AND provider_customer_id IS NOT NULL"),
      subscriptions: await one("SELECT COUNT(*)::int n FROM subscriptions WHERE provider='stripe' AND provider_subscription_id IS NOT NULL"),
    },
    subs: await rows(`SELECT s.tenant_id, s.plan, s.status, s.current_period_end, s.provider_subscription_id, s.provider_customer_id, t.name
                        FROM subscriptions s LEFT JOIN tenants t ON t.id=s.tenant_id
                       WHERE s.provider='stripe' AND s.provider_subscription_id IS NOT NULL
                       ORDER BY s.updated_at DESC LIMIT 100`),
    invoices: await rows(`SELECT i.provider_invoice_id, i.tenant_id, i.status, i.amount_due, i.amount_paid, i.currency,
                                 i.hosted_invoice_url, i.created_at, t.name
                            FROM invoices i LEFT JOIN tenants t ON t.id=i.tenant_id
                           WHERE i.provider='stripe' ORDER BY i.created_at DESC LIMIT 30`),
  };
}

export default async function SaasStripePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = getStripeConfigStatus();
  const { counts, subs, invoices } = await mirror();
  const webhookUrl = `${getAppBaseUrl()}/api/saas/stripe/webhook`;

  return (
    <PageShell>
      <PageHeader
        breadcrumb={breadcrumb}
        title="Stripe"
        description="Miroir des abonnements et factures Stripe. La gestion fine se fait dans le Dashboard Stripe (liens « Ouvrir dans Stripe »)."
        actions={s.enabled ? <form action={syncAllPlansAction}><button className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}><RefreshCw className="h-4 w-4" />Synchroniser les plans</button></form> : undefined}
      />

      {sp.synced ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{sp.synced} plan(s) synchronisé(s) avec Stripe.</div> : null}
      {sp.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">{sp.error}</div> : null}
      {!s.enabled ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900">
          <Banknote className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>Stripe désactivé (<code className="font-mono">STRIPE_ENABLED=false</code>). Aucune opération Stripe n&apos;est effectuée.</span>
        </div>
      ) : null}

      <SectionCard icon={Banknote} title="Configuration (sans secret)">
        <MetadataGrid columns={3} items={[
          { label: "STRIPE_ENABLED", value: yn(s.enabled) },
          { label: "Mode", value: <code className="font-mono text-[12px]">{s.mode}</code> },
          { label: "Clé secrète", value: yn(s.secretKeyPresent) },
          { label: "Secret webhook", value: yn(s.webhookSecretPresent) },
          { label: "Plans synchronisés", value: counts.plans },
          { label: "Clients Stripe", value: counts.customers },
        ]} />
        <div className="mt-3 rounded-xl border p-3 text-[12px]" style={{ borderColor: "var(--border)" }}>
          <div className="font-semibold" style={{ color: "var(--text-main)" }}>Endpoint webhook à configurer dans Stripe :</div>
          <code className="mt-1 block break-all font-mono text-[11.5px] text-slate-600">{webhookUrl}</code>
          <div className="mt-1 text-slate-500">Événements : checkout.session.completed, customer.subscription.*, invoice.* · <a href={`${stripeDashboardBase()}/webhooks`} target="_blank" rel="noreferrer" style={{ color: "var(--blue-600)" }}>Configurer dans Stripe ↗</a></div>
        </div>
      </SectionCard>

      <SectionCard icon={Banknote} title={`Abonnements Stripe (${subs.length})`} bodyClassName="p-0">
        {subs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Aucun abonnement Stripe synchronisé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-3 py-2">Client</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Échéance</th><th className="px-3 py-2">Stripe</th>
              </tr></thead>
              <tbody>
                {subs.map((r) => (
                  <tr key={String(r.provider_subscription_id)} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-3 py-2"><Link href={`/admin/saas/tenants/${r.tenant_id}`} style={{ color: "var(--blue-600)" }}>{String(r.name ?? r.tenant_id)}</Link></td>
                    <td className="px-3 py-2">{String(r.plan ?? "—")}</td>
                    <td className="px-3 py-2">{String(r.status ?? "—")}</td>
                    <td className="px-3 py-2 text-[11px]">{date(r.current_period_end)}</td>
                    <td className="px-3 py-2"><div className="flex flex-col gap-0.5"><OpenIn url={stripeSubscriptionUrl(String(r.provider_subscription_id))} label="Abonnement ↗" /><OpenIn url={stripeCustomerUrl(r.provider_customer_id ? String(r.provider_customer_id) : null)} label="Client ↗" /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Banknote} title={`Factures Stripe (${invoices.length})`} bodyClassName="p-0">
        {invoices.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Aucune facture Stripe.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-3 py-2">Client</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2 text-right">Dû</th><th className="px-3 py-2 text-right">Payé</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Liens</th>
              </tr></thead>
              <tbody>
                {invoices.map((r) => (
                  <tr key={String(r.provider_invoice_id)} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                    <td className="px-3 py-2">{String(r.name ?? r.tenant_id)}</td>
                    <td className="px-3 py-2">{String(r.status ?? "—")}</td>
                    <td className="px-3 py-2 text-right">{money(r.amount_due, r.currency)}</td>
                    <td className="px-3 py-2 text-right">{money(r.amount_paid, r.currency)}</td>
                    <td className="px-3 py-2 text-[11px]">{date(r.created_at)}</td>
                    <td className="px-3 py-2"><div className="flex flex-col gap-0.5">
                      {r.hosted_invoice_url ? <a href={String(r.hosted_invoice_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: "var(--blue-600)" }}>Facture ↗</a> : null}
                      <OpenIn url={stripeInvoiceUrl(String(r.provider_invoice_id))} label="Dans Stripe ↗" />
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <p className="text-[12px] text-slate-500">Diagnostic : <code className="font-mono">npm run saas:check-stripe</code>. Données internes : <Link href="/admin/saas/subscriptions" style={{ color: "var(--blue-600)" }}>Abonnements</Link> · <Link href="/admin/saas/billing" style={{ color: "var(--blue-600)" }}>Facturation</Link>.</p>
    </PageShell>
  );
}
