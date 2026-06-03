import { CalendarDays, Coins, Hash } from "lucide-react";
import type {
  AIDetectedAmount,
  AIDetectedDate,
  AIDetectedReference,
} from "@/lib/ai/types";
import { formatDetectedDate } from "@/lib/format";

type Props = {
  amounts: AIDetectedAmount[];
  dates: AIDetectedDate[];
  references: AIDetectedReference[];
  organizations: string[];
};

export function AIDetectedData({ amounts, dates, references, organizations }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Section icon={Coins} label="Montants détectés">
        {amounts.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1">
            {amounts.slice(0, 6).map((amount, index) => (
              <li key={index} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-slate-500">{amount.label}</span>
                <span className="font-semibold text-slate-900">
                  {amount.amount.toFixed(2)} {amount.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section icon={CalendarDays} label="Dates détectées">
        {dates.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1">
            {dates.slice(0, 6).map((date, index) => (
              <li key={index} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-slate-500">{date.label}</span>
                <span className="font-semibold text-slate-900">{formatDetectedDate(date.iso || date.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section icon={Hash} label="Références">
        {references.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1">
            {references.slice(0, 6).map((ref, index) => (
              <li key={index} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-slate-500">{ref.label}</span>
                <span className="truncate font-semibold text-slate-900">{ref.value}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section icon={Hash} label="Organismes détectés">
        {organizations.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1">
            {organizations.slice(0, 6).map((org, index) => (
              <li key={index} className="text-xs font-semibold text-slate-800">
                {org}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Coins;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-slate-400">Aucune information détectée.</p>;
}
