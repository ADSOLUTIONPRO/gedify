import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  Coins,
  Receipt,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import type { BudgetOverview } from "@/lib/budget/types";

export function BudgetOverviewCards({ overview }: { overview: BudgetOverview }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Revenus du mois"
        value={`${overview.revenuesPlanned.toFixed(0)} €`}
        helper={`${overview.revenuesReceived.toFixed(0)} € reçus`}
        icon={ArrowDownLeft}
        tone="emerald"
      />
      <StatCard
        label="Dépenses du mois"
        value={`${overview.expensesPlanned.toFixed(0)} €`}
        helper={`${overview.expensesPaid.toFixed(0)} € payés`}
        icon={ArrowUpRight}
        tone="violet"
      />
      <StatCard
        label="Dettes en cours"
        value={`${overview.debtsOutstanding.toFixed(0)} €`}
        helper="Reste à régler"
        icon={Receipt}
        tone="amber"
      />
      <StatCard
        label="Reste à vivre estimé"
        value={`${overview.cashEstimate.toFixed(0)} €`}
        helper={overview.cashEstimate >= 0 ? "Positif" : "Négatif"}
        icon={Wallet}
        tone={overview.cashEstimate >= 0 ? "emerald" : "amber"}
      />
      <StatCard
        label="À payer (7 j)"
        value={overview.upcoming7Days}
        helper="Échéances proches"
        icon={CalendarClock}
        tone="blue"
      />
      <StatCard
        label="En retard"
        value={overview.overdueCount}
        helper="Échéances dépassées"
        icon={AlertTriangle}
        tone={overview.overdueCount > 0 ? "amber" : "slate"}
      />
      <StatCard
        label="Mois en cours"
        value={overview.month}
        icon={CalendarCheck}
        tone="slate"
      />
      <StatCard
        label="Documents à valider"
        value={overview.unvalidatedDocuments}
        helper="Suggestions IA en attente"
        icon={Coins}
        tone="violet"
      />
    </div>
  );
}
