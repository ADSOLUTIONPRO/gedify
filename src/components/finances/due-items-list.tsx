import type { DueBucket } from "@/lib/budget/budget-calculations";
import type { FinancialItem } from "@/lib/budget/financial-item-types";

const BUCKET_LABEL: Record<DueBucket, { label: string; color: string }> = {
  overdue: { label: "En retard", color: "#EF4444" },
  this_week: { label: "7 prochains jours", color: "#F59E0B" },
  this_month: { label: "30 prochains jours", color: "#F97316" },
  later: { label: "Plus tard", color: "#0B5CFF" },
  undated: { label: "Sans date à traiter", color: "#64748B" },
};

/** Chips de synthèse par échéance (groupes), au-dessus du tableau. */
export function DueItemsBuckets({ bucketed }: { bucketed: Record<DueBucket, FinancialItem[]> }) {
  const order: DueBucket[] = ["overdue", "this_week", "this_month", "later", "undated"];
  return (
    <div className="flex flex-wrap gap-2">
      {order.map((b) => {
        const meta = BUCKET_LABEL[b];
        const count = bucketed[b].length;
        return (
          <span
            key={b}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold"
            style={{ borderColor: "var(--border)", color: count > 0 ? meta.color : "var(--text-muted)" }}
          >
            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: count > 0 ? meta.color : "var(--border)" }} />
            {meta.label}
            <span className="rounded-md px-1.5 text-[11px]" style={{ background: `${meta.color}14` }}>{count}</span>
          </span>
        );
      })}
    </div>
  );
}
