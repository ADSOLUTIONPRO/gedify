import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { BudgetComparison, type ComparisonRow } from "@/components/finances/budget-comparison";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { currentBudgetMonth } from "@/lib/budget/budget-periods";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Prévisions — Finances" };

export default async function FinancesPrevisionsPage() {
  const month = currentBudgetMonth();
  const items = (await listFinancialItems({ budgetMonth: month, direction: "outgoing" }));

  // Réalisé par catégorie (poste). Le prévu démarre sur le réalisé (écart 0),
  // l'utilisateur ajuste ensuite.
  const byCategory = new Map<string, number>();
  for (const item of items) {
    const cat = item.categoryName || "Autres dépenses";
    byCategory.set(cat, Math.round(((byCategory.get(cat) ?? 0) + item.amount) * 100) / 100);
  }
  const rows: ComparisonRow[] =
    byCategory.size > 0
      ? [...byCategory.entries()].map(([category, realized]) => ({ category, realized, plannedDefault: realized }))
      : [
          { category: "Logement", realized: 0, plannedDefault: 0 },
          { category: "Énergie", realized: 0, plannedDefault: 0 },
          { category: "Assurance", realized: 0, plannedDefault: 0 },
          { category: "Autres dépenses", realized: 0, plannedDefault: 0 },
        ];

  return (
    <SpaceLayout spaceId="finances">
      <BudgetComparison rows={rows} month={month} />
    </SpaceLayout>
  );
}
