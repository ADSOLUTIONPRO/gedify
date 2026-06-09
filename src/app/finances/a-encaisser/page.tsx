import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinancialItemsTable } from "@/components/finances/financial-items-table";
import { FinancePageHeader } from "@/components/finances/finance-page-header";
import { AddFinancialItemButton } from "@/components/finances/financial-item-form";
import { listFinancialItems } from "@/lib/budget/financial-item-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "À encaisser — Finances" };

/**
 * « À encaisser » : sommes restant à recevoir (revenus entrants non encore
 * réglés / partiellement réglés). Distinct de « Vue d'ensemble » (tableau de
 * bord global) et de « Encaissements » (tous les revenus, reçus inclus).
 */
export default async function FinancesAEncaisserPage() {
  const items = (await listFinancialItems({ direction: "incoming" })).filter(
    (i) => i.status !== "paid" && (i.amountRemaining ?? Math.max(0, i.amount - i.amountPaid)) > 0.005,
  );
  const total = items.reduce((s, i) => s + (i.amountRemaining ?? Math.max(0, i.amount - i.amountPaid)), 0);
  return (
    <SpaceLayout spaceId="finances" actions={<AddFinancialItemButton kind="revenue" label="Ajouter un revenu" color="#16A34A" />}>
      <div className="space-y-4">
        <FinancePageHeader
          title="À encaisser"
          description="Factures non réglées, revenus attendus, paiements partiels et échéances à venir."
          count={items.length}
          countNoun="encaissement"
          total={total}
          totalLabel="à recevoir"
        />
        <FinancialItemsTable items={items} emptyLabel="Aucune somme à encaisser." allowPayment />
      </div>
    </SpaceLayout>
  );
}
