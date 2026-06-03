"use client";

import { useMemo, useState } from "react";
import { formatAmount } from "@/components/finances/finance-labels";

export type ComparisonRow = {
  category: string;
  realized: number;
  /** Prévu initial proposé (ex. récurrents). Éditable côté client. */
  plannedDefault: number;
};

/**
 * Comparatif prévisionnel / réalisé par catégorie. Le prévu est éditable
 * localement (planification non encore persistée — saisie de travail).
 */
export function BudgetComparison({ rows, month }: { rows: ComparisonRow[]; month: string }) {
  const [planned, setPlanned] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.category, r.plannedDefault]))
  );

  const totals = useMemo(() => {
    let p = 0;
    let r = 0;
    for (const row of rows) {
      p += planned[row.category] ?? 0;
      r += row.realized;
    }
    return { planned: p, realized: r };
  }, [rows, planned]);

  return (
    <div className="space-y-3">
      <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        Mois <strong style={{ color: "var(--text-main)" }}>{month}</strong> · saisissez le prévu par poste pour
        comparer au réalisé. (Planification de travail, non encore enregistrée.)
      </p>
      <div className="overflow-x-auto rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <th className="px-3 py-2 font-semibold">Poste</th>
              <th className="px-3 py-2 text-right font-semibold">Prévu</th>
              <th className="px-3 py-2 text-right font-semibold">Réalisé</th>
              <th className="px-3 py-2 text-right font-semibold">Écart</th>
              <th className="px-3 py-2 text-right font-semibold">% consommé</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const plan = planned[row.category] ?? 0;
              const ecart = Math.round((row.realized - plan) * 100) / 100;
              const pct = plan > 0 ? Math.round((row.realized / plan) * 100) : 0;
              return (
                <tr key={row.category} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: "var(--text-main)" }}>{row.category}</td>
                  <td className="px-3 py-2 text-right">
                    <input
                      value={plan}
                      onChange={(e) => setPlanned((p) => ({ ...p, [row.category]: Number(e.target.value) || 0 }))}
                      inputMode="decimal"
                      className="h-8 w-24 rounded-lg border px-2 text-right text-[12.5px] outline-none"
                      style={{ borderColor: "var(--border)" }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold" style={{ color: "var(--text-main)" }}>{formatAmount(row.realized)}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: ecart > 0 ? "var(--danger)" : "#15803D" }}>
                    {ecart > 0 ? "+" : ""}{formatAmount(ecart)}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: pct > 100 ? "var(--danger)" : "var(--text-muted)" }}>{pct}%</td>
                </tr>
              );
            })}
            <tr className="border-t-2" style={{ borderColor: "var(--border)" }}>
              <td className="px-3 py-2 font-bold" style={{ color: "var(--text-main)" }}>Total</td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: "var(--text-main)" }}>{formatAmount(totals.planned)}</td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: "var(--text-main)" }}>{formatAmount(totals.realized)}</td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: totals.realized - totals.planned > 0 ? "var(--danger)" : "#15803D" }}>
                {formatAmount(totals.realized - totals.planned)}
              </td>
              <td className="px-3 py-2" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
