import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinanceOverview } from "@/components/finances/finance-overview";
import { MobileFinances } from "@/components/mobile/mobile-finances";
import { AddFinancialItemButton } from "@/components/finances/financial-item-form";
import { formatDate } from "@/lib/format";
import {
  getAllCorrespondentsFinancialSummary,
} from "@/lib/budget/budget-calculations";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { aggregateFinances, filterByBucket } from "@/lib/budget/finance-bucket";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Finances — Gedify" };

export default async function FinancesPage() {
  const [correspondents, allItems] = await Promise.all([
    getAllCorrespondentsFinancialSummary(),
    listFinancialItems(),
  ]);

  // SOURCE DE VÉRITÉ UNIQUE : une ligne = une seule catégorie exclusive (§2-5).
  // Cartes, listes et résumé dérivent tous de cette agrégation → cohérence
  // garantie (carte == page) et plus de double comptage.
  const agg = aggregateFinances(allItems);
  const toReview = filterByBucket(allItems, "to_review");
  const dueSoon = filterByBucket(allItems, "due_soon");
  const overdue = filterByBucket(allItems, "overdue");

  // ── Données pour la version mobile (< md) ──
  const mobileToCollect = agg.income.total;
  const mobileToCollectCount = agg.income.count;
  const mobileForecast = dueSoon.reduce((s, i) => s + (i.amountRemaining ?? i.amount), 0);
  const mobileInvoices = [...allItems]
    .sort((a, b) => (b.documentDate ?? b.createdAt).localeCompare(a.documentDate ?? a.createdAt))
    .slice(0, 6)
    .map((i) => ({
      id: i.id,
      label: i.label,
      correspondent: i.correspondentName,
      dateLabel: formatDate(i.documentDate ?? i.createdAt),
      amount: i.amount,
      currency: i.currency,
      statusKey: i.status,
    }));

  return (
    <>
      {/* Mobile (< md) : Finances « app » */}
      <MobileFinances
        toCollect={mobileToCollect}
        toCollectCount={mobileToCollectCount}
        expenses={agg.expense.total}
        expensesCount={agg.expense.count}
        result={agg.netBalance}
        forecast={mobileForecast}
        invoices={mobileInvoices}
      />

      {/* Bureau (≥ md) : layout d'espace complet */}
      <div className="hidden md:block">
    <SpaceLayout
      spaceId="finances"
      actions={
        <>
          <AddFinancialItemButton kind="expense" label="Dépense" color="#0B5CFF" />
          <AddFinancialItemButton kind="revenue" label="Revenu" color="#16A34A" />
          <AddFinancialItemButton kind="debt" label="Dette" color="#F97316" />
        </>
      }
    >
      <FinanceOverview
        kpis={{
          revenuesMonth: agg.income.total,
          expensesMonth: agg.expense.total,
          upcomingExpenses: agg.dueSoon.total,
          debtsRemaining: agg.debt.total,
          overdue: agg.overdue.count,
          toReview: agg.toReview.count,
          paidThisMonth: agg.expense.total,
          remaining: agg.debt.total + agg.dueSoon.total + agg.overdue.total,
        }}
        toReview={toReview}
        dueSoon={dueSoon}
        overdue={overdue}
        monthSummary={{
          revenuesReceived: agg.income.total,
          revenuesToCollect: 0,
          expensesPaid: agg.expense.total,
          upcomingExpenses: agg.dueSoon.total,
          debtsRemaining: agg.debt.total,
          remaining: agg.debt.total + agg.dueSoon.total + agg.overdue.total,
          estimatedBalance: agg.netBalance,
        }}
        correspondents={correspondents}
      />
    </SpaceLayout>
      </div>
    </>
  );
}
