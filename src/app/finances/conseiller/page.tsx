import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { FinanceAdvisor, type AdvisorTip } from "@/components/finances/finance-advisor";
import { formatAmount } from "@/components/finances/finance-labels";
import { getAllDueItems, getAllDebts, getOverdueItems } from "@/lib/budget/budget-calculations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conseiller IA — Finances" };

export default async function FinancesConseillerPage() {
  const [overdue, due, debts] = await Promise.all([getOverdueItems(), getAllDueItems(), getAllDebts()]);
  const tips: AdvisorTip[] = [];

  if (overdue.length > 0) {
    const total = overdue.reduce((s, i) => s + (i.amountRemaining ?? i.amount), 0);
    tips.push({
      id: "overdue",
      severity: "danger",
      title: `${overdue.length} paiement(s) en retard`,
      detail: `Total dû ${formatAmount(total)}. Priorisez les plus anciens, ou demandez un délai / échéancier au créancier.`,
    });
  }
  const soon = [...due.bucketed.this_week];
  if (soon.length > 0) {
    const total = soon.reduce((s, i) => s + (i.amountRemaining ?? i.amount), 0);
    tips.push({
      id: "soon",
      severity: "warning",
      title: `${soon.length} échéance(s) sous 7 jours`,
      detail: `${formatAmount(total)} à régler prochainement. Programmez les paiements ou créez des rappels.`,
    });
  }
  const bigDebts = debts.filter((d) => (d.amountRemaining ?? d.amount) > 500);
  if (bigDebts.length > 0) {
    tips.push({
      id: "debts",
      severity: "info",
      title: `${bigDebts.length} dette(s) importante(s)`,
      detail: "Pour les montants élevés, un échéancier ou une contestation peut être pertinent. Générez un courrier type.",
    });
  }

  return (
    <SpaceLayout spaceId="finances">
      <FinanceAdvisor tips={tips} />
    </SpaceLayout>
  );
}
