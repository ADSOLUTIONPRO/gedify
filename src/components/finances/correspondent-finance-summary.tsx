import { formatAmount } from "@/components/finances/finance-labels";
import { formatDate } from "@/lib/format";
import type { CorrespondentBudgetSummary } from "@/lib/budget/budget-calculations";

/** Tableau des sommes par correspondant (dû / payé / reste / retard / prochaine échéance). */
export function CorrespondentFinanceSummary({ rows }: { rows: CorrespondentBudgetSummary[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Aucune donnée par correspondant</p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>Les montants liés aux correspondants apparaîtront ici.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b text-left" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <th className="px-3 py-2 font-semibold">Correspondant</th>
            <th className="px-3 py-2 text-right font-semibold">Total dû</th>
            <th className="px-3 py-2 text-right font-semibold">Payé</th>
            <th className="px-3 py-2 text-right font-semibold">Reste dû</th>
            <th className="px-3 py-2 text-right font-semibold">En retard</th>
            <th className="px-3 py-2 text-right font-semibold">Prochaine</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.correspondentId ?? c.correspondentName} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
              <td className="px-3 py-2 font-semibold" style={{ color: "var(--text-main)" }}>{c.correspondentName}</td>
              <td className="px-3 py-2 text-right" style={{ color: "var(--text-main)" }}>{formatAmount(c.total)}</td>
              <td className="px-3 py-2 text-right" style={{ color: "var(--text-muted)" }}>{formatAmount(c.paid)}</td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: c.remaining > 0 ? "var(--orange)" : "var(--text-muted)" }}>{formatAmount(c.remaining)}</td>
              <td className="px-3 py-2 text-right" style={{ color: c.overdue > 0 ? "var(--danger)" : "var(--text-muted)" }}>{c.overdue > 0 ? formatAmount(c.overdue) : "—"}</td>
              <td className="px-3 py-2 text-right" style={{ color: "var(--text-muted)" }}>{c.nextDueDate ? formatDate(c.nextDueDate) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
