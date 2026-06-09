import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinancialItemsTable } from "@/components/finances/financial-items-table";
import { FinancePageHeader } from "@/components/finances/finance-page-header";
import { AddFinancialItemButton } from "@/components/finances/financial-item-form";
import { ReconciliationPanel } from "@/components/finances/reconciliation-panel";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { filterByBucket } from "@/lib/budget/finance-bucket";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dettes — Finances" };

export default async function FinancesDettesPage() {
  // Carte == page : catégorie exclusive « debt » (dû, sans échéance proche ni
  // dépassée). Les échéances proches/dépassées sont dans À payer bientôt / En retard.
  const debts = filterByBucket(await listFinancialItems(), "debt");
  const remaining = debts.reduce((s, d) => s + (d.amountRemaining ?? Math.max(0, d.amount - d.amountPaid)), 0);
  return (
    <SpaceLayout spaceId="finances" actions={<AddFinancialItemButton kind="debt" label="Ajouter une dette" color="#F97316" />}>
      <div className="space-y-4">
        <FinancePageHeader title="Dettes en cours" description="Suivez les montants dus, les échéances et les régularisations à venir." count={debts.length} countNoun="dette" total={remaining} totalLabel="restants dus" />
        <ReconciliationPanel />
        <FinancialItemsTable items={debts} emptyLabel="Aucune dette enregistrée." allowPayment />
      </div>
    </SpaceLayout>
  );
}
