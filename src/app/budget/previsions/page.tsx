import { Coins, Receipt, TrendingUp, Wallet } from "lucide-react";
import { DueItemsTable } from "@/components/budget/due-items-table";
import { HelpCard } from "@/components/ui/help-card";
import { InfoMetric } from "@/components/ui/info-metric";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { buildForecast } from "@/lib/budget/budget-store";

export const dynamic = "force-dynamic";

export default async function ForecastsPage() {
  const forecast = await buildForecast(31);

  return (
    <main className="p-4 lg:p-6">
      <PageHeader
        compact
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Prévisions sur 30 jours"
        description="Si toutes les échéances prévues sont payées, voici le solde estimé en fin de période."
      />

      <HelpCard
        compact
        tone="blue"
        icon={TrendingUp}
        title="Comment lire ces chiffres ?"
        description="Revenus prévus − dépenses programmées − dettes à échéance. Les suggestions IA non validées ne comptent pas."
        className="mb-4"
      />

      <section className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <InfoMetric
          label="Revenus attendus"
          value={`${forecast.expectedRevenues.toFixed(0)} €`}
          icon={TrendingUp}
          tone="green"
        />
        <InfoMetric
          label="Dépenses prévues"
          value={`${forecast.expectedExpenses.toFixed(0)} €`}
          icon={Receipt}
          tone="violet"
        />
        <InfoMetric
          label="Dettes prévues"
          value={`${forecast.expectedDebts.toFixed(0)} €`}
          icon={Coins}
          tone="amber"
        />
        <InfoMetric
          label="Reste estimé"
          value={`${forecast.cashScenario.toFixed(0)} €`}
          helper={forecast.cashScenario >= 0 ? "Scénario positif" : "Scénario négatif"}
          icon={Wallet}
          tone={forecast.cashScenario >= 0 ? "green" : "amber"}
        />
      </section>

      <SectionCard title="Échéances incluses dans le scénario" bodyClassName="">
        {forecast.dueItems.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">
            Aucune échéance détectée dans les 31 prochains jours.
          </p>
        ) : (
          <DueItemsTable items={forecast.dueItems} />
        )}
      </SectionCard>
    </main>
  );
}
