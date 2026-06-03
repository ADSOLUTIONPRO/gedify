import Link from "next/link";
import { CircleDollarSign } from "lucide-react";

type BudgetLine = {
  label: string;
  count: number;
};

type BudgetIndicatorsCardProps = {
  lines: BudgetLine[];
};

export function BudgetIndicatorsCard({ lines }: BudgetIndicatorsCardProps) {
  return (
    <div
      className="rounded-2xl bg-white p-5"
      style={{ border: "1px solid var(--border)", boxShadow: "0 2px 16px -4px rgba(8,18,37,0.07)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "rgba(11,92,255,0.1)" }}
          >
            <CircleDollarSign className="h-4 w-4" style={{ color: "var(--blue-600)" }} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h3 className="text-sm font-extrabold" style={{ color: "var(--text-main)" }}>
            Indicateurs budget
          </h3>
        </div>
        <Link
          href="/budget"
          className="text-xs font-semibold transition-colors hover:opacity-80"
          style={{ color: "var(--blue-600)" }}
        >
          Voir le détail →
        </Link>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {lines.map((line) => (
          <div key={line.label} className="flex items-center justify-between py-2.5">
            <span className="text-sm font-medium" style={{ color: "var(--text-main)" }}>
              {line.label}
            </span>
            <span
              className="min-w-[24px] text-center text-sm font-bold"
              style={{ color: line.count > 0 ? "var(--blue-600)" : "var(--text-muted)" }}
            >
              {line.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
