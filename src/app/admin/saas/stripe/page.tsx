import { Banknote } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { MetadataGrid } from "@/components/ui/metadata-grid";
import { getStripeConfigStatus } from "@/lib/saas/stripe/stripe-config";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { label: "Stripe" },
];

function yn(v: boolean): string {
  return v ? "Oui" : "Non";
}

export default function SaasStripePage() {
  const s = getStripeConfigStatus();
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
