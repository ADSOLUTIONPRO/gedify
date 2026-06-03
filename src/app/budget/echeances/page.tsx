import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { CompactEmptyState } from "@/components/ui/compact-empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { InfoMetric } from "@/components/ui/info-metric";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getAllDueItems } from "@/lib/budget/budget-calculations";
import { formatMoney } from "@/lib/format-money";
import {
  KIND_LABELS,
  PAYMENT_STATUS_LABELS,
  STATUS_LABELS,
  type FinancialItem,
} from "@/lib/budget/financial-item-types";

export const dynamic = "force-dynamic";

function totalRemaining(items: FinancialItem[]): number {
  return items.reduce(
    (sum, entry) => sum + (entry.amountRemaining ?? entry.amount),
    0,
  );
}

export default async function DueItemsPage() {
  const { bucketed, all } = await getAllDueItems();

  return (
    <main className="p-4 lg:p-6">
      <PageHeader
        compact
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Échéances"
        description={`${all.length} échéance(s) ouverte(s) : retards, 7 jours, mois, à venir et sans date.`}
      />

      <HelpCard
        compact
        tone="blue"
        icon={CalendarClock}
        title="Comment ça marche"
        description="Toute dépense, dette ou item budgétaire avec une date d'échéance — ou avec un statut « à contrôler » — apparaît ici jusqu'à ce qu'il soit payé, annulé ou ignoré."
        className="mb-4"
      />

      <section className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <InfoMetric
          label="En retard"
          value={bucketed.overdue.length}
          helper={formatMoney(totalRemaining(bucketed.overdue))}
          icon={AlertTriangle}
          tone={bucketed.overdue.length > 0 ? "red" : "neutral"}
        />
        <InfoMetric
          label="Sous 7 jours"
          value={bucketed.this_week.length}
          helper={formatMoney(totalRemaining(bucketed.this_week))}
          icon={CalendarClock}
          tone="amber"
        />
        <InfoMetric
          label="Ce mois"
          value={bucketed.this_month.length}
          helper={formatMoney(totalRemaining(bucketed.this_month))}
          icon={CalendarDays}
          tone="blue"
        />
        <InfoMetric
          label="Plus tard"
          value={bucketed.later.length}
          helper={formatMoney(totalRemaining(bucketed.later))}
          icon={CalendarCheck}
          tone="neutral"
        />
        <InfoMetric
          label="Sans date"
          value={bucketed.undated.length}
          helper="à dater ou à contrôler"
          icon={HelpCircle}
          tone="violet"
        />
      </section>

      <Bucket
        title="En retard"
        description="Échéances dépassées non payées."
        tone="red"
        icon={AlertTriangle}
        items={bucketed.overdue}
        emptyHint="Aucune échéance en retard."
      />
      <Bucket
        title="Sous 7 jours"
        description="À régler dans la semaine."
        tone="amber"
        icon={CalendarClock}
        items={bucketed.this_week}
        emptyHint="Rien d'imminent."
      />
      <Bucket
        title="Ce mois"
        description="Sous 30 jours."
        tone="blue"
        icon={CalendarDays}
        items={bucketed.this_month}
        emptyHint="Aucune échéance sur le mois."
      />
      <Bucket
        title="Plus tard"
        description="Au-delà de 30 jours."
        tone="neutral"
        icon={CalendarCheck}
        items={bucketed.later}
        emptyHint="Aucune échéance future."
      />
      <Bucket
        title="Sans date"
        description="À dater ou à contrôler (souvent issu de l'IA)."
        tone="violet"
        icon={HelpCircle}
        items={bucketed.undated}
        emptyHint="Tout est daté."
        className="mb-0"
      />
    </main>
  );
}

type BucketTone = "red" | "amber" | "blue" | "neutral" | "violet";

function Bucket({
  title,
  description,
  icon: Icon,
  items,
  emptyHint,
  tone,
  className = "mb-4",
}: {
  title: string;
  description: string;
  icon: typeof CalendarClock;
  items: FinancialItem[];
  emptyHint: string;
  tone: BucketTone;
  className?: string;
}) {
  return (
    <SectionCard
      icon={Icon}
      title={`${title} (${items.length})`}
      description={description}
      bodyClassName=""
      className={className}
    >
      {items.length === 0 ? (
        <div className="p-4">
          <CompactEmptyState icon={Icon} title={emptyHint} description="" />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items
            .slice()
            .sort((a, b) => {
              const da = a.dueDate ? a.dueDate : "9999";
              const db = b.dueDate ? b.dueDate : "9999";
              return da.localeCompare(db);
            })
            .map((item) => (
              <li key={item.id} className="p-3 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800">{item.label}</span>
                    {item.correspondentName ? (
                      <span className="ml-1 text-[11px] text-slate-500">
                        · {item.correspondentName}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={`whitespace-nowrap font-bold ${
                      tone === "red" ? "text-rose-700" : "text-slate-900"
                    }`}
                  >
                    {formatMoney(item.amountRemaining ?? item.amount, item.currency)}
                  </span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
                  <span>{KIND_LABELS[item.kind]}</span>
                  <span>·</span>
                  <span>
                    {item.dueDate
                      ? new Date(item.dueDate).toLocaleDateString("fr-FR")
                      : "sans date"}
                  </span>
                  <span>·</span>
                  <span
                    className={
                      item.paymentStatus === "overdue"
                        ? "font-semibold text-rose-700"
                        : "text-slate-600"
                    }
                  >
                    {PAYMENT_STATUS_LABELS[item.paymentStatus]}
                  </span>
                  <span>·</span>
                  <span>{STATUS_LABELS[item.status]}</span>
                  {item.sourceDocumentId ? (
                    <>
                      <span>·</span>
                      <Link
                        href={`/ia/document/${item.sourceDocumentId}`}
                        className="inline-flex items-center gap-0.5 font-semibold text-blue-700 hover:underline"
                      >
                        Document
                        <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                      </Link>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
        </ul>
      )}
    </SectionCard>
  );
}
