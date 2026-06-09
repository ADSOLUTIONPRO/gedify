import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinancialItemsTable } from "@/components/finances/financial-items-table";
import { FinancePageHeader } from "@/components/finances/finance-page-header";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { filterByBucket } from "@/lib/budget/finance-bucket";
import { firstParam, type PageSearchParams } from "@/lib/page-params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Échéances — Finances" };

/**
 * Échéances à traiter. Utilise les catégories exclusives pour rester cohérent
 * avec les cartes (carte == page) :
 *  - ?bucket=overdue        → En retard (overdue) uniquement
 *  - ?bucket=later|due_soon → À payer bientôt (due_soon) uniquement
 *  - sans paramètre         → En retard + À payer bientôt
 */
export default async function FinancesEcheancesPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const bucket = firstParam(params, "bucket");
  const all = await listFinancialItems();
  const overdue = filterByBucket(all, "overdue");
  const dueSoon = filterByBucket(all, "due_soon");

  let items = [...overdue, ...dueSoon];
  let title = "Échéances à traiter";
  let description = "En retard et à payer bientôt.";
  if (bucket === "overdue") { items = overdue; title = "En retard"; description = "Échéances dépassées non réglées."; }
  else if (bucket === "later" || bucket === "due_soon" || bucket === "this_week" || bucket === "this_month") {
    items = dueSoon; title = "À payer bientôt"; description = "Échéances à venir dans les 30 jours.";
  }

  const remaining = items.reduce((s, i) => s + (i.amountRemaining ?? Math.max(0, i.amount - i.amountPaid)), 0);
  return (
    <SpaceLayout spaceId="finances">
      <div className="space-y-4">
        <FinancePageHeader title={title} description={description} count={items.length} countNoun="échéance" total={remaining} totalLabel="restants à régler" />
        <FinancialItemsTable items={items} emptyLabel="Aucune échéance à traiter." allowPayment />
      </div>
    </SpaceLayout>
  );
}
