import { Banknote, PlugZap, ShieldCheck, Wallet } from "lucide-react";
import { CompactEmptyState } from "@/components/ui/compact-empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { InfoMetric } from "@/components/ui/info-metric";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

export const dynamic = "force-dynamic";

export default function BankAccountsPage() {
  return (
    <main className="p-4 lg:p-6">
      <PageHeader
        compact
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Comptes bancaires"
        description="Agrégation des comptes (Bridge, Powens, Tink…) — à connecter."
      />

      <HelpCard
        compact
        tone="amber"
        icon={ShieldCheck}
        title="Conformité PSD2"
        description="Aucun connecteur bancaire n'est encore activé. L'agrégation passera par un prestataire DSP2 agréé. Aucun identifiant bancaire ne sera stocké côté GED — le token sera détenu par le prestataire."
        className="mb-4"
      />

      <section className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <InfoMetric label="Comptes" value={0} helper="connectés" icon={Wallet} tone="neutral" />
        <InfoMetric label="Solde total" value="—" icon={Banknote} tone="neutral" />
        <InfoMetric label="Provider" value="—" icon={PlugZap} tone="neutral" />
        <InfoMetric label="Sync" value="—" helper="jamais" icon={ShieldCheck} tone="neutral" />
      </section>

      <SectionCard
        icon={PlugZap}
        title="Aucun compte bancaire"
        description="Module à connecter."
      >
        <div className="p-4">
          <CompactEmptyState
            icon={Wallet}
            title="À connecter"
            description="Branchement d'un agrégateur (Bridge, Powens, Tink) prévu. Pas de saisie manuelle d'identifiants bancaires."
          />
        </div>
      </SectionCard>
    </main>
  );
}
