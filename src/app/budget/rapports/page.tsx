import { BarChart3 } from "lucide-react";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Rapports"
        description="Synthèses mensuelles et annuelles. À connecter."
      />
      <HelpCard
        tone="amber"
        icon={BarChart3}
        title="Rapports avancés — à connecter"
        description="Les agrégats sont disponibles via /api/budget/overview et /api/budget/forecasts. La vue rapports (par catégorie, par mois, par dossier) sera ajoutée prochainement."
      />
    </main>
  );
}
