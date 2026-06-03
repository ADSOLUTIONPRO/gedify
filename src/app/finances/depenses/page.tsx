import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinancialItemsTable } from "@/components/finances/financial-items-table";
import { FinancePageHeader } from "@/components/finances/finance-page-header";
import { AddFinancialItemButton } from "@/components/finances/financial-item-form";
import { listFinancialItems } from "@/lib/budget/financial-item-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dépenses — Finances" };

export default async function FinancesDepensesPage() {
  const items = (await listFinancialItems({ direction: "outgoing" })).filter(
    (i) => i.kind !== "debt" && i.kind !== "loan" && i.kind !== "installment"
  );
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <SpaceLayout spaceId="finances" actions={<AddFinancialItemButton kind="expense" label="Ajouter une dépense" color="#0B5CFF" />}>
      <div className="space-y-4">
        <FinancePageHeader title="Dépenses" description="Toutes vos dépenses : payées, à payer et à venir." count={items.length} countNoun="dépense" total={total} totalLabel="au total" />
        <FinancialItemsTable items={items} emptyLabel="Aucune dépense enregistrée." allowPayment />
      </div>
    </SpaceLayout>
  );
}
