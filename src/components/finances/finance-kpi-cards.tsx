import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

/** Indicateurs Finances calculés côté serveur (page.tsx). */
export type FinanceKpis = {
  revenuesMonth: number;
  expensesMonth: number;
  upcomingExpenses: number;
  debtsRemaining: number;
  overdue: number;
  toReview: number;
  paidThisMonth: number;
  remaining: number;
};

/** Carte KPI prête à afficher (libellé + valeur déjà formatés par le parent). */
export type KpiCard = {
  key: string;
  label: string;
  value: string;
  helper?: string;
  color: string;
  soft: string;
  icon: LucideIcon;
  href: string;
};

/**
 * Bandeau de cartes KPI Finances (maquette) : surfaces pastel soutenues,
 * icône teintée, chevron, valeur en bleu nuit, sous-texte coloré. Cliquables.
 */
export function FinanceKpiCards({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Link
            key={c.key}
            href={c.href}
            className="group flex flex-col rounded-[18px] p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: c.soft, boxShadow: "var(--shadow-xs)" }}
          >
            <div className="flex items-center justify-between">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${c.color}1F`, color: c.color }}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <ChevronRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-0.5" style={{ color: c.color }} strokeWidth={2} aria-hidden="true" />
            </div>
            <span className="mt-3 text-[12.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>{c.label}</span>
            <span className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--gedify-navy)" }}>{c.value}</span>
            {c.helper ? <span className="mt-1 text-[11.5px] font-medium" style={{ color: c.color }}>{c.helper}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
