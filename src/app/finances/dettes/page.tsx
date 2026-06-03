import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinancialItemsTable } from "@/components/finances/financial-items-table";
import { FinancePageHeader } from "@/components/finances/finance-page-header";
import { AddFinancialItemButton } from "@/components/finances/financial-item-form";
import { ReconciliationPanel } from "@/components/finances/reconciliation-panel";
import { getAllDebts } from "@/lib/budget/budget-calculations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dettes — Finances" };

export default async function FinancesDettesPage() {
  // Toutes les dettes, quelle que soit la date (passées / futures / sans date).
  const debts = await getAllDebts();
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
