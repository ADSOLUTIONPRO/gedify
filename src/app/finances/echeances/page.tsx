import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinancialItemsTable } from "@/components/finances/financial-items-table";
import { FinancePageHeader } from "@/components/finances/finance-page-header";
import { DueItemsBuckets } from "@/components/finances/due-items-list";
import { getAllDueItems } from "@/lib/budget/budget-calculations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Échéances — Finances" };

export default async function FinancesEcheancesPage() {
  const due = await getAllDueItems();
  const remaining = due.all.reduce((s, i) => s + (i.amountRemaining ?? Math.max(0, i.amount - i.amountPaid)), 0);
  return (
    <SpaceLayout spaceId="finances">
      <div className="space-y-4">
        <FinancePageHeader title="Échéances à traiter" description="Classées par délai : en retard, à payer bientôt, plus tard, sans date." count={due.all.length} countNoun="échéance" total={remaining} totalLabel="restants à régler" />
        <DueItemsBuckets bucketed={due.bucketed} />
        <FinancialItemsTable items={due.all} emptyLabel="Aucune échéance à traiter." allowPayment />
      </div>
    </SpaceLayout>
  );
}
