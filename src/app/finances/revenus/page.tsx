import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinancialItemsTable } from "@/components/finances/financial-items-table";
import { FinancePageHeader } from "@/components/finances/finance-page-header";
import { AddFinancialItemButton } from "@/components/finances/financial-item-form";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { filterByBucket } from "@/lib/budget/finance-bucket";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Revenus — Finances" };

export default async function FinancesRevenusPage() {
  // Carte == page : catégorie exclusive « income » (lignes entrantes actives,
  // hors suggestions à contrôler).
  const items = filterByBucket(await listFinancialItems(), "income");
  const toCollect = items.filter((i) => i.status !== "paid").reduce((s, i) => s + (i.amountRemaining ?? i.amount), 0);
  return (
    <SpaceLayout spaceId="finances" actions={<AddFinancialItemButton kind="revenue" label="Ajouter un revenu" color="#16A34A" />}>
      <div className="space-y-4">
        <FinancePageHeader title="Encaissements" description="Revenus encaissés et montants à encaisser." count={items.length} countNoun="revenu" total={toCollect} totalLabel="à encaisser" />
        <FinancialItemsTable items={items} emptyLabel="Aucun revenu enregistré." />
      </div>
    </SpaceLayout>
  );
}
