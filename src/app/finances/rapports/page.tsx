import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { formatAmount } from "@/components/finances/finance-labels";
import { FinanceDiagnosticPanel } from "@/components/finances/finance-diagnostic-panel";
import { getYearlySummary } from "@/lib/budget/budget-calculations";
import { currentBudgetYear } from "@/lib/budget/budget-periods";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rapports — Finances" };

export default async function FinancesRapportsPage() {
  const year = currentBudgetYear();
  const summary = await getYearlySummary(year);

  const totals = summary.months.reduce(
    (acc, m) => ({
      incoming: acc.incoming + m.incoming,
      outgoing: acc.outgoing + m.outgoing,
      paid: acc.paid + m.paid,
      remaining: acc.remaining + m.remaining,
    }),
    { incoming: 0, outgoing: 0, paid: 0, remaining: 0 }
  );

  return (
    <SpaceLayout spaceId="finances">
      <div className="mb-4">
        <FinanceDiagnosticPanel />
      </div>
      <p className="mb-3 text-[13px]" style={{ color: "var(--text-muted)" }}>
        Rapport annuel <strong style={{ color: "var(--text-main)" }}>{year}</strong> — revenus, dépenses, payé et reste dû par mois.
      </p>
      {summary.months.length === 0 ? (
        <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Aucune donnée pour {year}</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>Les montants apparaîtront ici dès qu&apos;ils seront rattachés à un mois.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                <th className="px-3 py-2 font-semibold">Mois</th>
                <th className="px-3 py-2 text-right font-semibold">Revenus</th>
                <th className="px-3 py-2 text-right font-semibold">Dépenses</th>
                <th className="px-3 py-2 text-right font-semibold">Payé</th>
                <th className="px-3 py-2 text-right font-semibold">Reste dû</th>
                <th className="px-3 py-2 text-right font-semibold">Solde estimé</th>
              </tr>
            </thead>
            <tbody>
              {summary.months.map((m) => (
                <tr key={m.month} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: "var(--text-main)" }}>{m.month}</td>
                  <td className="px-3 py-2 text-right" style={{ color: "#15803D" }}>{formatAmount(m.incoming)}</td>
                  <td className="px-3 py-2 text-right" style={{ color: "var(--text-main)" }}>{formatAmount(m.outgoing)}</td>
                  <td className="px-3 py-2 text-right" style={{ color: "var(--text-muted)" }}>{formatAmount(m.paid)}</td>
                  <td className="px-3 py-2 text-right" style={{ color: m.remaining > 0 ? "var(--orange)" : "var(--text-muted)" }}>{formatAmount(m.remaining)}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: m.incoming - m.outgoing >= 0 ? "#15803D" : "var(--danger)" }}>{formatAmount(m.incoming - m.outgoing)}</td>
                </tr>
              ))}
              <tr className="border-t-2" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2 font-bold" style={{ color: "var(--text-main)" }}>Total {year}</td>
                <td className="px-3 py-2 text-right font-bold" style={{ color: "#15803D" }}>{formatAmount(totals.incoming)}</td>
                <td className="px-3 py-2 text-right font-bold" style={{ color: "var(--text-main)" }}>{formatAmount(totals.outgoing)}</td>
                <td className="px-3 py-2 text-right font-bold" style={{ color: "var(--text-muted)" }}>{formatAmount(totals.paid)}</td>
                <td className="px-3 py-2 text-right font-bold" style={{ color: "var(--orange)" }}>{formatAmount(totals.remaining)}</td>
                <td className="px-3 py-2 text-right font-bold" style={{ color: totals.incoming - totals.outgoing >= 0 ? "#15803D" : "var(--danger)" }}>{formatAmount(totals.incoming - totals.outgoing)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </SpaceLayout>
  );
}
