import Link from "next/link";
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Bell, Building2, CalendarClock, CheckCircle2,
  ChevronRight, Clock, Coins, Eye, FileText,
} from "lucide-react";
import { FinanceKpiCards, type FinanceKpis, type KpiCard } from "@/components/finances/finance-kpi-cards";
import { formatAmount, KIND_LABEL } from "@/components/finances/finance-labels";
import { formatDate } from "@/lib/format";
import type { FinancialItem } from "@/lib/budget/financial-item-types";
import type { CorrespondentBudgetSummary } from "@/lib/budget/budget-calculations";

export type MonthSummary = {
  revenuesReceived: number;
  revenuesToCollect: number;
  expensesPaid: number;
  upcomingExpenses: number;
  debtsRemaining: number;
  remaining: number;
  estimatedBalance: number;
};

type FinanceOverviewProps = {
  kpis: FinanceKpis;
  toReview: FinancialItem[];
  dueSoon: FinancialItem[];
  overdue: FinancialItem[];
  monthSummary: MonthSummary;
  correspondents: CorrespondentBudgetSummary[];
};

const signed = (v: number) => `${v >= 0 ? "+" : ""}${formatAmount(v)}`;

/* ── Carte « surface » réutilisable ───────────────────────────────────────── */
function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-[18px] bg-white p-4 ${className ?? ""}`} style={{ boxShadow: "var(--shadow-card)" }}>
      {children}
    </section>
  );
}

function CardHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[15px] font-extrabold" style={{ color: "var(--gedify-navy)" }}>{title}</h2>
      {action}
    </div>
  );
}

/* ── Donut SVG (revenus vs dépenses, solde au centre) ─────────────────────── */
function Donut({ revenues, expenses, balance }: { revenues: number; expenses: number; balance: number }) {
  const total = revenues + expenses || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  const revLen = (revenues / total) * c;
  const expLen = (expenses / total) * c;
  return (
    <div className="relative h-[128px] w-[128px] shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--bg-card)" strokeWidth="14" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="#16A34A" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(0, revLen - 2)} ${c}`} />
        <circle cx="64" cy="64" r={r} fill="none" stroke="#F75C8D" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.max(0, expLen - 2)} ${c}`} strokeDashoffset={-revLen} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-extrabold leading-none" style={{ color: balance >= 0 ? "#15803D" : "#DC2626" }}>{signed(balance)}</span>
        <span className="mt-0.5 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Solde net</span>
      </div>
    </div>
  );
}

/* ── Barres agrégées (pas de série journalière → revenus/dépenses) ────────── */
function Bars({ m }: { m: MonthSummary }) {
  const bars = [
    { v: m.revenuesReceived, color: "#16A34A" },
    { v: m.revenuesToCollect, color: "#86C7A1" },
    { v: m.expensesPaid, color: "#F75C8D" },
    { v: m.upcomingExpenses, color: "#F9B6CD" },
  ];
  const max = Math.max(...bars.map((b) => b.v), 1);
  return (
    <div className="flex min-w-[120px] flex-1 flex-col">
      <div className="flex h-[100px] items-end justify-center gap-2.5">
        {bars.map((b, i) => (
          <div key={i} className="flex h-full w-7 items-end">
            <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(4, (b.v / max) * 100)}%`, background: b.color }} title={formatAmount(b.v)} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-3 text-[10.5px] font-semibold" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#16A34A" }} /> Revenus</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#F75C8D" }} /> Dépenses</span>
      </div>
    </div>
  );
}

/* ── Résumé du mois ───────────────────────────────────────────────────────── */
function MonthSummaryCard({ m }: { m: MonthSummary }) {
  const monthLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const revenues = m.revenuesReceived + m.revenuesToCollect;
  const expenses = m.expensesPaid + m.upcomingExpenses;
  return (
    <Card>
      <CardHead
        title="Résumé du mois"
        action={<span className="rounded-lg px-2.5 py-1 text-[12px] font-semibold capitalize" style={{ background: "var(--bg-card-soft)", color: "var(--text-secondary)" }}>{monthLabel}</span>}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <dl className="w-full space-y-2 sm:w-[160px]">
          {[
            ["Solde net", signed(m.estimatedBalance), m.estimatedBalance >= 0 ? "#15803D" : "#DC2626"],
            ["Revenus", formatAmount(revenues), "#15803D"],
            ["Dépenses", formatAmount(expenses), "#DB2777"],
          ].map(([label, value, color]) => (
            <div key={label} className="flex items-baseline justify-between gap-2 rounded-lg px-2 py-1.5" style={{ background: "var(--bg-card-soft)" }}>
              <dt className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>{label}</dt>
              <dd className="text-[13.5px] font-extrabold tabular-nums" style={{ color }}>{value}</dd>
            </div>
          ))}
        </dl>
        <Bars m={m} />
        <Donut revenues={revenues} expenses={expenses} balance={m.estimatedBalance} />
      </div>
    </Card>
  );
}

/* ── Lignes à valider ─────────────────────────────────────────────────────── */
function ValidationLines({ items }: { items: FinancialItem[] }) {
  return (
    <Card>
      <CardHead
        title={`Lignes à valider${items.length ? ` (${items.length})` : ""}`}
      />
      {items.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune ligne à valider.</p>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 5).map((i) => {
            const positive = i.direction === "incoming";
            return (
              <Link key={i.id} href="/finances/documents" className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[var(--bg-card-soft)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: positive ? "var(--gedify-green-soft)" : "var(--gedify-pink-soft)", color: positive ? "#15803D" : "#DB2777" }}>
                  {positive ? <ArrowDownLeft className="h-4 w-4" strokeWidth={2} /> : <ArrowUpRight className="h-4 w-4" strokeWidth={2} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>{i.label}</span>
                  <span className="block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {i.correspondentName ?? KIND_LABEL[i.kind]}{i.dueDate ? ` · ${formatDate(i.dueDate)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums" style={{ color: positive ? "#15803D" : "var(--text-main)" }}>
                  {positive ? "+" : "−"}{formatAmount(Math.abs(i.amount), i.currency)}
                </span>
                <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--gedify-green-soft)", color: "#15803D" }}>Valider</span>
              </Link>
            );
          })}
          <Link href="/finances/documents" className="mt-1 inline-flex items-center gap-1 px-2 text-[12.5px] font-bold" style={{ color: "var(--accent)" }}>
            Voir toutes les lignes à valider <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </Link>
        </div>
      )}
    </Card>
  );
}

/* ── Correspondants principaux (cartes) ───────────────────────────────────── */
function CorrespondentCards({ rows }: { rows: CorrespondentBudgetSummary[] }) {
  return (
    <Card>
      <CardHead title="Correspondants principaux" action={<Link href="/finances/correspondants" className="text-[12.5px] font-bold" style={{ color: "var(--accent)" }}>Voir tout</Link>} />
      {rows.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune donnée par correspondant.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {rows.slice(0, 5).map((c) => {
            const tone = c.overdue > 0 ? { bg: "var(--gedify-red-soft)", color: "#B91C1C", label: "En retard" }
              : c.remaining > 0 ? { bg: "var(--gedify-orange-soft)", color: "#B45309", label: "À régler" }
              : { bg: "var(--gedify-green-soft)", color: "#15803D", label: "À jour" };
            return (
              <Link key={c.correspondentId ?? c.correspondentName} href="/finances/correspondants" className="flex flex-col gap-2 rounded-xl p-3 transition hover:-translate-y-0.5" style={{ background: "var(--bg-card-soft)" }}>
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "#fff", color: "var(--text-muted)" }}>
                    <Building2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 truncate text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>{c.correspondentName}</span>
                </span>
                <span className="w-fit rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: tone.bg, color: tone.color }}>{tone.label}</span>
                <span className="text-[13px] font-extrabold tabular-nums" style={{ color: "var(--gedify-navy)" }}>{formatAmount(c.remaining > 0 ? c.remaining : c.total)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ── Rail droit : détail de l'échéance ────────────────────────────────────── */
function DueDetailRail({ item }: { item: FinancialItem | null }) {
  if (!item) {
    return (
      <Card>
        <CardHead title="Détail de l'échéance" />
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2 className="h-8 w-8" style={{ color: "#16A34A" }} strokeWidth={1.5} />
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>Aucune échéance à venir</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Tout est à jour.</p>
        </div>
      </Card>
    );
  }
  const rows: [string, React.ReactNode][] = [
    ["Échéance", item.dueDate ? formatDate(item.dueDate) : "—"],
    ["Catégorie", item.categoryName ?? KIND_LABEL[item.kind]],
    ["Correspondant", item.correspondentName ?? "—"],
  ];
  if (item.invoiceNumber) rows.push(["N° facture", item.invoiceNumber]);
  if (item.paidDate) rows.push(["Dernier paiement", formatDate(item.paidDate)]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-extrabold" style={{ color: "var(--gedify-navy)" }}>Détail de l&apos;échéance</h2>
        <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--gedify-orange-soft)", color: "#B45309" }}>À payer</span>
      </div>

      <div className="rounded-xl p-3" style={{ background: "var(--bg-card-soft)" }}>
        <div className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "#fff", color: "var(--accent)" }}>
              <CalendarClock className="h-4.5 w-4.5" strokeWidth={1.85} style={{ width: 18, height: 18 }} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{item.label}</span>
              <span className="block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{KIND_LABEL[item.kind]}</span>
            </span>
          </span>
          <span className="shrink-0 text-[16px] font-extrabold tabular-nums" style={{ color: "var(--gedify-navy)" }}>{formatAmount(item.amount, item.currency)}</span>
        </div>
      </div>

      <dl className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <dt style={{ color: "var(--text-muted)" }}>{label}</dt>
            <dd className="text-right font-semibold" style={{ color: "var(--text-main)" }}>{value}</dd>
          </div>
        ))}
        {item.sourceDocumentId ? (
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <dt style={{ color: "var(--text-muted)" }}>Facture</dt>
            <dd className="text-right">
              <Link href={`/documents/${item.sourceDocumentId}`} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--accent)" }}>
                <FileText className="h-3.5 w-3.5" strokeWidth={2} /> Document
              </Link>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 space-y-2">
        {item.sourceDocumentId ? (
          <Link href={`/documents/${item.sourceDocumentId}`} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
            <FileText className="h-4 w-4" strokeWidth={2} /> Ouvrir le document
          </Link>
        ) : null}
        <Link href="/finances/echeances" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-[13px] font-bold transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border-strong)", color: "var(--text-main)" }}>
          <Eye className="h-4 w-4" strokeWidth={1.85} /> Voir dans les échéances
        </Link>
        <Link href="/rappels" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-[13px] font-bold transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border-strong)", color: "var(--text-main)" }}>
          <Bell className="h-4 w-4" strokeWidth={1.85} /> Programmer un rappel
        </Link>
      </div>
    </Card>
  );
}

/** Vue d'ensemble Finances (maquette) : KPIs + résumé/donut + à valider + correspondants + rail détail. */
export function FinanceOverview({ kpis, toReview, dueSoon, overdue, monthSummary, correspondents }: FinanceOverviewProps) {
  const sum = (items: FinancialItem[]) => items.reduce((s, i) => s + i.amount, 0);
  const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
  const kpiCards: KpiCard[] = [
    { key: "rev", label: "Revenus", value: formatAmount(kpis.revenuesMonth), helper: "ce mois-ci", color: "#16A34A", soft: "#EAF8EF", icon: ArrowDownLeft, href: "/finances/revenus" },
    { key: "exp", label: "Dépenses", value: formatAmount(kpis.expensesMonth), helper: "ce mois-ci", color: "#F75C8D", soft: "#FDECF2", icon: ArrowUpRight, href: "/finances/depenses" },
    { key: "debt", label: "Dettes", value: formatAmount(kpis.debtsRemaining), helper: "en cours", color: "#64748B", soft: "#F1F5F9", icon: Coins, href: "/finances/dettes" },
    { key: "soon", label: "À payer bientôt", value: formatAmount(kpis.upcomingExpenses), helper: plural(dueSoon.length, "échéance"), color: "#F59E0B", soft: "#FFF4E5", icon: CalendarClock, href: "/finances/echeances?bucket=later" },
    { key: "late", label: "En retard", value: formatAmount(sum(overdue)), helper: plural(overdue.length, "échéance"), color: "#EF4444", soft: "#FDECEC", icon: AlertTriangle, href: "/finances/echeances?bucket=overdue" },
    { key: "ctrl", label: "À contrôler", value: formatAmount(sum(toReview)), helper: `${toReview.length} à vérifier`, color: "#2563EB", soft: "#ECF3FF", icon: Eye, href: "/finances/documents?filtre=controler" },
  ];

  const detailItem = dueSoon[0] ?? overdue[0] ?? null;

  return (
    <div className="space-y-5">
      <FinanceKpiCards cards={kpiCards} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <MonthSummaryCard m={monthSummary} />
          <ValidationLines items={toReview} />
          <CorrespondentCards rows={correspondents} />
        </div>
        <DueDetailRail item={detailItem} />
      </div>

      {/* Listes complémentaires : à payer bientôt / en retard */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="À payer bientôt" action={<Link href="/finances/echeances" className="text-[12.5px] font-bold" style={{ color: "#F59E0B" }}>Tout voir</Link>} />
          {dueSoon.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}><Clock className="h-4 w-4" />Aucune échéance proche.</p>
          ) : dueSoon.slice(0, 5).map((i) => (
            <Link key={i.id} href="/finances/echeances" className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[12.5px] transition hover:bg-[var(--bg-card-soft)]">
              <span className="min-w-0"><span className="block truncate font-semibold" style={{ color: "var(--text-main)" }}>{i.label}</span><span className="block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{i.correspondentName ?? KIND_LABEL[i.kind]}{i.dueDate ? ` · ${formatDate(i.dueDate)}` : ""}</span></span>
              <span className="shrink-0 font-bold" style={{ color: "var(--text-main)" }}>{formatAmount(i.amount, i.currency)}</span>
            </Link>
          ))}
        </Card>
        <Card>
          <CardHead title="En retard" action={<Link href="/finances/echeances" className="text-[12.5px] font-bold" style={{ color: "#EF4444" }}>Tout voir</Link>} />
          {overdue.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}><CheckCircle2 className="h-4 w-4" style={{ color: "#16A34A" }} />Aucun retard. 🎉</p>
          ) : overdue.slice(0, 5).map((i) => (
            <Link key={i.id} href="/finances/echeances" className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[12.5px] transition hover:bg-[var(--bg-card-soft)]">
              <span className="min-w-0"><span className="block truncate font-semibold" style={{ color: "var(--text-main)" }}>{i.label}</span><span className="block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{i.correspondentName ?? KIND_LABEL[i.kind]}{i.dueDate ? ` · ${formatDate(i.dueDate)}` : ""}</span></span>
              <span className="shrink-0 font-bold" style={{ color: "#DC2626" }}>{formatAmount(i.amount, i.currency)}</span>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
