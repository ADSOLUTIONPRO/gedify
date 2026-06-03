import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinanceOverview } from "@/components/finances/finance-overview";
import { MobileFinances } from "@/components/mobile/mobile-finances";
import { AddFinancialItemButton } from "@/components/finances/financial-item-form";
import { formatDate } from "@/lib/format";
import {
  getAllCorrespondentsFinancialSummary,
  getAllDebts,
  getAllDueItems,
  getMonthlySummary,
  getOverdueItems,
} from "@/lib/budget/budget-calculations";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { currentBudgetMonth } from "@/lib/budget/budget-periods";
import { getPrincipalType } from "@/lib/budget/finance-classification";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Finances — Gedify" };

export default async function FinancesPage() {
  const [monthSummary, due, overdue, debts, correspondents, allItems] = await Promise.all([
    getMonthlySummary(currentBudgetMonth()),
    getAllDueItems(),
    getOverdueItems(),
    getAllDebts(),
    getAllCorrespondentsFinancialSummary(),
    listFinancialItems(),
  ]);

  const totals = monthSummary.totals;
  const toReview = allItems.filter((i) => i.status === "to_review" || i.status === "suggested" || i.validationStatus === "needs_review");
  const debtsRemaining = debts.reduce((sum, d) => sum + (d.amountRemaining ?? Math.max(0, d.amount - d.amountPaid)), 0);
  const dueSoon = [...due.bucketed.this_week, ...due.bucketed.this_month];

  // Dépenses à venir : lignes dont le type principal dérivé est « dépense à venir ».
  const upcomingExpenses = allItems
    .filter((i) => getPrincipalType(i) === "depense_a_venir")
    .reduce((s, i) => s + (i.amountRemaining ?? Math.max(0, i.amount - i.amountPaid)), 0);

  // ── Données pour la version mobile (< md) ──
  const incomingItems = allItems.filter((i) => i.direction === "incoming");
  const expenseItems = allItems.filter((i) => i.direction === "outgoing");
  const mobileToCollect = Math.max(0, totals.incoming - totals.incomingReceived);
  const mobileToCollectCount = incomingItems.filter((i) => i.status !== "paid").length;
  const mobileForecast = allItems.filter((i) => i.status === "scheduled").reduce((s, i) => s + i.amount, 0);
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
        expenses={totals.outgoing}
        expensesCount={expenseItems.length}
        result={totals.incoming - totals.outgoing}
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
          revenuesMonth: totals.incoming,
          expensesMonth: totals.outgoing,
          upcomingExpenses,
          debtsRemaining,
          overdue: overdue.length,
          toReview: toReview.length,
          paidThisMonth: totals.outgoingPaid,
          remaining: totals.remaining,
        }}
        toReview={toReview}
        dueSoon={dueSoon}
        overdue={overdue}
        monthSummary={{
          revenuesReceived: totals.incomingReceived,
          revenuesToCollect: Math.max(0, totals.incoming - totals.incomingReceived),
          expensesPaid: totals.outgoingPaid,
          upcomingExpenses,
          debtsRemaining,
          remaining: totals.remaining,
          estimatedBalance: totals.incoming - totals.outgoing,
        }}
        correspondents={correspondents}
      />
    </SpaceLayout>
      </div>
    </>
  );
}
