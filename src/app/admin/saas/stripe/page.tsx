import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { getStripeConfigStatus } from "@/lib/saas/stripe/config";
import { postgresActive } from "@/lib/db/pg-store";
import { getPool } from "@/lib/db/pg";

export const dynamic = "force-dynamic";

async function stripeCounts(): Promise<{ plans: number; customers: number; subscriptions: number }> {
  if (!postgresActive()) return { plans: 0, customers: 0, subscriptions: 0 };
  const pool = await getPool();
  const one = async (sql: string) => {
    try { return Number((await pool.query(sql)).rows[0]?.n ?? 0); } catch { return 0; }
  };
  return {
    plans: await one("SELECT COUNT(*)::int n FROM saas_plans WHERE stripe_product_id IS NOT NULL"),
    customers: await one("SELECT COUNT(DISTINCT provider_customer_id)::int n FROM subscriptions WHERE provider='stripe' AND provider_customer_id IS NOT NULL"),
    subscriptions: await one("SELECT COUNT(*)::int n FROM subscriptions WHERE provider='stripe' AND provider_subscription_id IS NOT NULL"),
  };
}

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Stripe" },
];

function yn(v: boolean): string {
  return v ? "Oui" : "Non";
}

export default async function SaasStripePage() {
  const s = getStripeConfigStatus();
  const counts = await stripeCounts();
  return (
    <PageShell>
      <PageHeader breadcrumb={breadcrumb} title="Stripe" description="Configuration Stripe (préparation). Aucun secret affiché ; aucun appel tant que désactivé." />

      {!s.enabled ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900">
          <Banknote className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>Stripe pas encore activé (<code className="font-mono">STRIPE_ENABLED=false</code>). Aucune opération Stripe ne sera effectuée.</span>
        </div>
      ) : null}

      <SectionCard icon={Banknote} title="État de la configuration">
        <MetadataGrid
          columns={3}
          items={[
            { label: "STRIPE_ENABLED", value: yn(s.enabled) },
            { label: "STRIPE_MODE", value: <code className="font-mono text-[12px]">{s.mode}</code> },
            { label: "Clé secrète", value: yn(s.secretKeyPresent) },
            { label: "Secret webhook", value: yn(s.webhookSecretPresent) },
            { label: "Price Free", value: yn(s.priceFreePresent) },
            { label: "Price Pro", value: yn(s.priceProPresent) },
            { label: "Price Business", value: yn(s.priceBusinessPresent) },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Banknote} title="Liens Stripe">
        <MetadataGrid
          columns={3}
          items={[
            { label: "Plans synchronisés", value: counts.plans },
            { label: "Clients Stripe liés", value: counts.customers },
            { label: "Abonnements Stripe", value: counts.subscriptions },
          ]}
        />
        <p className="mt-3 text-[12px] text-slate-500">Diagnostic CLI : <code className="font-mono">npm run saas:check-stripe</code>. Synchroniser un plan : page « Plans & offres » → bouton « Synchroniser avec Stripe ».</p>
      </SectionCard>

      <SectionCard icon={Banknote} title="Synchronisation (bientôt)">
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled className="h-10 cursor-not-allowed rounded-xl border px-4 text-[13px] font-semibold opacity-60" style={{ borderColor: "var(--border)" }}>
            Synchroniser les plans avec Stripe (bientôt)
          </button>
          <button type="button" disabled className="h-10 cursor-not-allowed rounded-xl border px-4 text-[13px] font-semibold opacity-60" style={{ borderColor: "var(--border)" }}>
            Synchroniser les codes promo (bientôt)
          </button>
        </div>
        <p className="mt-3 text-[12px] text-slate-500">Webhooks : à configurer (placeholder). Produits/prices : mappés via les champs <code className="font-mono">stripe_*</code> des plans et codes promo.</p>
      </SectionCard>
    </PageShell>
  );
}
