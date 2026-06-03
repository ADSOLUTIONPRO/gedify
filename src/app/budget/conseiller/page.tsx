import {
  Calculator,
  HelpCircle,
  PiggyBank,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { CompactEmptyState } from "@/components/ui/compact-empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { InfoMetric } from "@/components/ui/info-metric";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getBudgetTotals } from "@/lib/budget/budget-calculations";
import { currentBudgetMonth } from "@/lib/budget/budget-periods";
import { formatMoney } from "@/lib/format-money";

export const dynamic = "force-dynamic";

export default async function BudgetAdvisorPage() {
  const month = currentBudgetMonth();
  const totals = await getBudgetTotals({ budgetMonth: month, validatedOnly: true });
  const solde = totals.incomingReceived - totals.outgoingPaid;

  return (
    <main className="p-4 lg:p-6">
      <PageHeader
        compact
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Conseiller IA"
        description="Analyse votre situation budgétaire et propose des actions concrètes. Module à connecter."
      />

      <HelpCard
        compact
        tone="violet"
        icon={Sparkles}
        title="Conseiller IA — à connecter"
        description="Les conseils générés ici utiliseront vos FinancialItem validés (revenus, dépenses, dettes, échéances) pour proposer des arbitrages, un échéancier, une priorisation des dettes ou un courrier modèle. Aucune information bancaire n'est utilisée tant qu'aucun connecteur n'est branché."
        className="mb-4"
      />

      <section className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <InfoMetric
          label="Mois en cours"
          value={month}
          icon={HelpCircle}
          tone="neutral"
        />
        <InfoMetric
          label="Solde estimé"
          value={formatMoney(solde)}
          helper="reçus − payés"
          icon={TrendingUp}
          tone={solde >= 0 ? "green" : "red"}
        />
        <InfoMetric
          label="Reste à payer"
          value={formatMoney(totals.remaining)}
          icon={Calculator}
          tone="amber"
        />
        <InfoMetric
          label="Retards"
          value={totals.overdueCount}
          icon={PiggyBank}
          tone={totals.overdueCount > 0 ? "red" : "neutral"}
        />
      </section>

      <SectionCard
        icon={Sparkles}
        title="Conseils du mois"
        description="Suggestions basées sur vos validations."
      >
        <div className="p-4">
          <CompactEmptyState
            icon={Sparkles}
            title="À connecter"
            description="Le générateur de conseils sera branché sur OpenAI (modèle de raisonnement) en mode serveur uniquement, avec contexte limité aux FinancialItem validés et aux Actions ouvertes."
          />
        </div>
      </SectionCard>
    </main>
  );
}
