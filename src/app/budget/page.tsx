import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  Coins,
  FileText,
  Filter,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AddDebtModal } from "@/components/budget/add-debt-modal";
import { AddExpenseModal } from "@/components/budget/add-expense-modal";
import { AddRevenueModal } from "@/components/budget/add-revenue-modal";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { CompactEmptyState } from "@/components/ui/compact-empty-state";
import { GradientPanel } from "@/components/ui/gradient-panel";
import { InfoMetric } from "@/components/ui/info-metric";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { QuickAccessCard, QuickAccessGrid } from "@/components/ui/quick-access-card";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatusPill } from "@/components/ui/status-pill";
import {
  getAllCorrespondentsFinancialSummary,
  getBudgetTotals,
  getDueItemsWindow,
  getMonthlySummary,
} from "@/lib/budget/budget-calculations";
import { currentBudgetMonth } from "@/lib/budget/budget-periods";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { formatMoney } from "@/lib/format-money";
import {
  KIND_LABELS,
  PAYMENT_STATUS_LABELS,
  type FinancialItem,
} from "@/lib/budget/financial-item-types";

export const dynamic = "force-dynamic";

export default async function BudgetHubPage() {
  const month = currentBudgetMonth();
  const [monthSummary, totals, dueItems, byCorrespondent, allItems, pending] = await Promise.all([
    getMonthlySummary(month),
    getBudgetTotals({ budgetMonth: month, validatedOnly: true }),
    getDueItemsWindow(7),
    getAllCorrespondentsFinancialSummary(),
    listFinancialItems({ limit: 50 }),
    listFinancialItems({ validationStatus: "pending" }),
  ]);

  const topCategories = byCorrespondent.slice(0, 5);
  const overdueItems = allItems.filter((entry) => entry.paymentStatus === "overdue");
  const monthlyBalance = totals.incomingReceived - totals.outgoingPaid;

  const detectedToControl = allItems
    .filter((it) => it.validationStatus === "pending" || it.validationStatus === "needs_review")
    .slice(0, 6);

  const tabs = [
    { href: "/budget", label: "Vue d'ensemble" },
    { href: "/budget/revenus", label: "Revenus" },
    { href: "/budget/depenses", label: "Dépenses" },
    { href: "/budget/dettes", label: "Dettes" },
    { href: "/budget/echeances", label: "Échéances" },
    { href: "/budget/previsions", label: "Prévisions" },
  ];

  const detectedColumns: DataTableColumn<FinancialItem>[] = [
    {
      header: "Élément",
      cell: (item) => (
        <div className="min-w-0">
          <p className="truncate font-bold" style={{ color: "var(--text-main)" }}>
            {item.label}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {KIND_LABELS[item.kind]}
            {item.correspondentName ? ` · ${item.correspondentName}` : ""}
          </p>
        </div>
      ),
    },
    {
      header: "Montant",
      cell: (item) => (
        <span
          className={`font-bold ${
            item.direction === "incoming" ? "text-emerald-700" : ""
          }`}
          style={item.direction === "incoming" ? undefined : { color: "var(--text-main)" }}
        >
          {item.direction === "incoming" ? "+" : ""}
          {formatMoney(item.amount, item.currency)}
        </span>
      ),
    },
    {
      header: "Échéance",
      cell: (item) => (
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {item.dueDate ? new Date(item.dueDate).toLocaleDateString("fr-FR") : "—"}
        </span>
      ),
    },
    {
      header: "Statut",
      cell: (item) => {
        const status = item.paymentStatus;
        const tone =
          status === "overdue"
            ? "rose"
            : status === "paid"
            ? "emerald"
            : status === "due"
            ? "amber"
            : status === "due_soon"
            ? "blue"
            : "slate";
        return (
          <StatusPill tone={tone} dot>
            {PAYMENT_STATUS_LABELS[status]}
          </StatusPill>
        );
      },
    },
    {
      header: "",
      className: "text-right",
      cell: (item) => (
        <Link
          href={`/budget/documents/${item.id}`}
          className="text-xs font-bold"
          style={{ color: "var(--blue-600)" }}
        >
          Contrôler →
        </Link>
      ),
    },
  ];

  return (
    <PageShell>
      <PageHeader
        compact
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { label: "Budget" },
        ]}
        title="Budget personnel"
        description="À payer, retards, revenus et dépenses du mois."
        actions={
          <>
            <span
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <CalendarCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" style={{ color: "var(--blue-600)" }} />
              {month}
            </span>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <Filter className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Filtres
            </button>
            <AddRevenueModal />
            <AddExpenseModal />
            <AddDebtModal />
          </>
        }
      />

      <SegmentedTabs tabs={tabs} activeHref="/budget" />

      <section>
        <p className="mb-2 text-sm font-extrabold text-slate-900">Vue rapide</p>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <InfoMetric
          label="Revenus du mois"
          value={formatMoney(totals.incoming)}
          helper={`${formatMoney(totals.incomingReceived)} reçus`}
          icon={ArrowDownLeft}
          tone="green"
        />
        <InfoMetric
          label="Dépenses du mois"
          value={formatMoney(totals.outgoing)}
          helper={`${formatMoney(totals.outgoingPaid)} payés`}
          icon={ArrowUpRight}
          tone="violet"
        />
        <InfoMetric
          label="Dettes en cours"
          value={formatMoney(totals.remaining)}
          helper={totals.overdueCount > 0 ? `${totals.overdueCount} en retard` : "Aucun retard"}
          icon={Coins}
          tone={totals.overdueCount > 0 ? "red" : "amber"}
        />
        <InfoMetric
          label="Reste estimé"
          value={formatMoney(monthlyBalance)}
          helper={monthlyBalance >= 0 ? "Positif" : "À surveiller"}
          icon={Wallet}
          tone={monthlyBalance >= 0 ? "blue" : "red"}
        />
        <InfoMetric
          label="À payer 7j"
          value={dueItems.length}
          helper={overdueItems.length > 0 ? `${overdueItems.length} en retard` : "à venir"}
          icon={CalendarClock}
          tone={overdueItems.length > 0 ? "amber" : "blue"}
        />
        <InfoMetric label="En retard" value={overdueItems.length} helper="priorité" icon={AlertTriangle} tone={overdueItems.length > 0 ? "red" : "green"} />
        <InfoMetric label="Mois en cours" value={monthSummary.items.length} helper={month} icon={FileText} tone="neutral" />
        <InfoMetric label="À contrôler" value={pending.length} helper="suggestions IA" icon={Sparkles} tone="violet" />
        </div>
      </section>

      <SectionCard title="Actions rapides" description="Raccourcis budget compacts.">
        <QuickAccessGrid>
          <QuickAccessCard href="/budget/revenus" icon={ArrowDownLeft} tone="emerald" title="Revenus" description="Salaire, CAF, CPAM" />
          <QuickAccessCard href="/budget/depenses" icon={ArrowUpRight} tone="violet" title="Dépenses" description="Factures et charges" />
          <QuickAccessCard href="/budget/dettes" icon={Coins} tone="amber" title="Dettes" description="Crédits et impayés" />
          <QuickAccessCard href="/budget/echeances" icon={CalendarClock} tone="blue" title="Échéances" description="Calendrier à venir" />
          <QuickAccessCard href="/budget/previsions" icon={Wallet} tone="sky" title="Prévisions" description="Projection 30 jours" />
          <QuickAccessCard href="/budget/documents" icon={FileText} tone="slate" title="Documents financiers" description="À valider depuis l’IA" />
        </QuickAccessGrid>
      </SectionCard>

      <SectionCard
        title="Prévisionnel & Réalisé"
        description={`Évolution mensuelle · mois en cours ${month}.`}
        actions={
          <Link
            href="/budget/previsions"
            className="text-xs font-bold"
            style={{ color: "var(--blue-600)" }}
          >
            Voir le détail →
          </Link>
        }
      >
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(16,163,74,0.06)", border: "1px solid rgba(16,163,74,0.15)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#16A34A" }}>
              Revenus prévus
            </p>
            <p className="mt-1 text-xl font-extrabold" style={{ color: "var(--text-main)" }}>
              {formatMoney(totals.incoming)}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {formatMoney(totals.incomingReceived)} reçus
            </p>
          </div>
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.18)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#7C3AED" }}>
              Dépenses prévues
            </p>
            <p className="mt-1 text-xl font-extrabold" style={{ color: "var(--text-main)" }}>
              {formatMoney(totals.outgoing)}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {formatMoney(totals.outgoingPaid)} payés
            </p>
          </div>
          <div
            className="rounded-xl p-4"
            style={{
              background: monthlyBalance >= 0 ? "rgba(11,92,255,0.06)" : "rgba(239,68,68,0.06)",
              border: `1px solid ${monthlyBalance >= 0 ? "rgba(11,92,255,0.18)" : "rgba(239,68,68,0.18)"}`,
            }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-wide"
              style={{ color: monthlyBalance >= 0 ? "var(--blue-600)" : "#DC2626" }}
            >
              Solde projeté
            </p>
            <p className="mt-1 text-xl font-extrabold" style={{ color: "var(--text-main)" }}>
              {formatMoney(monthlyBalance)}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {monthlyBalance >= 0 ? "Solde positif" : "Solde négatif"}
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <SectionCard
          title="Éléments financiers détectés à contrôler"
          description={`${detectedToControl.length} item(s) en attente de validation`}
          actions={
            <Link
              href="/budget/documents"
              className="text-xs font-bold"
              style={{ color: "var(--blue-600)" }}
            >
              Voir tous →
            </Link>
          }
          bodyClassName=""
        >
          {detectedToControl.length === 0 ? (
            <CompactEmptyState
              icon={Sparkles}
              title="Aucun élément à contrôler"
              description="Lancez une analyse IA sur un document financier."
            />
          ) : (
            <DataTable
              rows={detectedToControl}
              columns={detectedColumns}
              getRowKey={(i) => i.id}
            />
          )}
        </SectionCard>

        <aside className="space-y-5">
          <GradientPanel
            icon={Sparkles}
            title="Conseiller IA"
            subtitle="Je peux analyser vos arbitrages mensuels et suggérer des actions."
            ctaHref="/budget/conseiller"
            ctaLabel="Lancer un conseil"
          >
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                <span style={{ color: "rgba(180,210,255,0.85)" }}>Documents financiers</span>
                <span className="font-bold text-white">{allItems.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                <span style={{ color: "rgba(180,210,255,0.85)" }}>En attente de validation</span>
                <span className="font-bold text-white">{pending.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                <span style={{ color: "rgba(180,210,255,0.85)" }}>Tendance solde</span>
                <span className="font-bold text-white">
                  {monthlyBalance >= 0 ? "Positive" : "À surveiller"}
                </span>
              </div>
            </div>
          </GradientPanel>

          <RightRailCard
            title="Top catégories"
            icon={Coins}
            iconTone="emerald"
            ctaHref="/budget/by-correspondent"
            ctaLabel="Voir tous"
            bodyClassName="space-y-2.5"
          >
            {topCategories.length === 0 ? (
              <p className="py-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Validez des suggestions IA pour voir les sommes par organisme.
              </p>
            ) : (
              topCategories.map((entry, index) => {
                const max = topCategories[0]?.remaining || 1;
                const ratio = Math.max(0.06, Math.min(1, entry.remaining / max));
                return (
                  <div key={`${entry.correspondentId ?? entry.correspondentName}-${index}`}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-semibold truncate" style={{ color: "var(--text-main)" }}>
                        {entry.correspondentName}
                      </span>
                      <span className="font-bold" style={{ color: "var(--text-main)" }}>
                        {formatMoney(entry.remaining)}
                      </span>
                    </div>
                    <div
                      className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: "rgba(11,92,255,0.06)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          background:
                            "linear-gradient(90deg, var(--blue-500) 0%, var(--blue-600) 100%)",
                          width: `${Math.round(ratio * 100)}%`,
                        }}
                      />
                    </div>
                    <p
                      className="mt-1 text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {entry.itemCount} document(s) · {formatMoney(entry.paid)} payés
                    </p>
                  </div>
                );
              })
            )}
          </RightRailCard>
        </aside>
      </div>
    </PageShell>
  );
}
