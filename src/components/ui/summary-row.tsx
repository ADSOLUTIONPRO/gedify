import type { ReactNode } from "react";

export type SummaryEntry = {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "emerald" | "violet" | "amber" | "rose";
  helper?: string;
};

const TONE: Record<NonNullable<SummaryEntry["tone"]>, string> = {
  neutral: "text-slate-900",
  emerald: "text-emerald-700",
  violet: "text-violet-700",
  amber: "text-amber-700",
  rose: "text-rose-700",
};

export function SummaryRows({ items }: { items: SummaryEntry[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((entry) => (
        <div
          key={entry.label}
          className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm"
        >
          <dt className="font-semibold text-slate-600">{entry.label}</dt>
          <dd className={`text-right font-bold ${TONE[entry.tone ?? "neutral"]}`}>
            {entry.value}
            {entry.helper ? (
              <span className="ml-1 text-[11px] font-medium text-slate-400">{entry.helper}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
