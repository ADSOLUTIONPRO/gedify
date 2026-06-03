import { ArrowLeftRight, PlugZap, Search } from "lucide-react";
import { CompactEmptyState } from "@/components/ui/compact-empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

export const dynamic = "force-dynamic";

export default function BankTransactionsPage() {
  return (
    <main className="p-4 lg:p-6">
      <PageHeader
        compact
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Transactions bancaires"
        description="Lettrage automatique des écritures bancaires avec vos documents et items budget — à connecter."
      />

      <HelpCard
        compact
        tone="blue"
        icon={Search}
        title="Lettrage automatique prévu"
        description="Quand un agrégateur sera connecté, chaque transaction sera proposée pour rapprochement avec un FinancialItem (montant + date + correspondant). Vous validez. Aucune écriture côté banque."
        className="mb-4"
      />

      <SectionCard
        icon={ArrowLeftRight}
        title="Aucune transaction"
        description="Module à connecter."
      >
        <div className="p-4">
          <CompactEmptyState
            icon={PlugZap}
            title="À connecter"
            description="Connectez un compte bancaire depuis /budget/comptes pour voir vos transactions ici."
          />
        </div>
      </SectionCard>
    </main>
  );
}
