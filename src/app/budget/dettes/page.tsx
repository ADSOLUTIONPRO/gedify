import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  Coins,
  ExternalLink,
  Filter,
  Plus,
  Wallet,
} from "lucide-react";
import { AddDebtModal } from "@/components/budget/add-debt-modal";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { listDebts } from "@/lib/budget/budget-store";
import { getAllDebts, getAllDueItems } from "@/lib/budget/budget-calculations";
import { formatMoney } from "@/lib/format-money";
import {
  KIND_LABELS,
  PAYMENT_STATUS_LABELS,
  STATUS_LABELS,
  type FinancialItem,
} from "@/lib/budget/financial-item-types";
import { firstParam, type PageSearchParams } from "@/lib/page-params";

export const dynamic = "force-dynamic";

function totalRemaining(items: FinancialItem[]): number {
  return items.reduce((sum, entry) => sum + (entry.amountRemaining ?? entry.amount), 0);
}

function paymentTone(
  status: FinancialItem["paymentStatus"]
): "blue" | "amber" | "emerald" | "rose" | "slate" {
  if (status === "overdue") return "rose";
  if (status === "paid") return "emerald";
  if (status === "due") return "amber";
  if (status === "due_soon") return "blue";
  return "slate";
}

export default async function DebtsPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const params = searchParams ? await searchParams : {};
  const view = firstParam(params, "view", "all");

  const [legacyDebts, financialDebts, dueItemsData] = await Promise.all([
    listDebts(),
    getAllDebts(),
    getAllDueItems(),
  ]);

  const overdueItems = dueItemsData.bucketed.overdue;
  const upcomingItems = [
    ...dueItemsData.bucketed.this_week,
    ...dueItemsData.bucketed.this_month,
  ];
  const allDebtItems = financialDebts;

  const legacyOutstanding = legacyDebts
    .filter((entry) => entry.status !== "settled" && entry.status !== "cancelled")
    .reduce((sum, entry) => sum + entry.remainingAmount, 0);
  const financialOutstanding = financialDebts.reduce(
    (sum, entry) => sum + (entry.amountRemaining ?? entry.amount),
    0
  );
  const outstanding = legacyOutstanding + financialOutstanding;
  const upcomingTotal = totalRemaining(upcomingItems);
  const overdueTotal = totalRemaining(overdueItems);
  const paidThisMonth = financialDebts
    .filter(
      (item) =>
        item.paymentStatus === "paid" &&
        item.paidDate &&
        new Date(item.paidDate).getMonth() === new Date().getMonth()
    )
    .reduce((sum, item) => sum + (item.amountPaid ?? item.amount), 0);

  const debtColumns: DataTableColumn<FinancialItem>[] = [
    {
      header: "Créancier",
      cell: (debt) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>
            {debt.correspondentName ?? debt.label}
          </p>
          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
            {debt.label}
            {debt.budgetMonth ? ` · ${debt.budgetMonth}` : ""}
          </p>
        </div>
      ),
    },
    {
      header: "Montant restant",
      cell: (debt) => (
        <span className="font-bold" style={{ color: "var(--text-main)" }}>
          {formatMoney(debt.amountRemaining ?? debt.amount, debt.currency)}
        </span>
      ),
    },
    {
      header: "Échéance",
      cell: (debt) => (
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {debt.dueDate ? new Date(debt.dueDate).toLocaleDateString("fr-FR") : "—"}
        </span>
      ),
    },
    {
      header: "Type",
      cell: (debt) => (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {KIND_LABELS[debt.kind]}
        </span>
      ),
    },
    {
      header: "Statut",
      cell: (debt) => (
        <StatusPill tone={paymentTone(debt.paymentStatus)} dot>
          {STATUS_LABELS[debt.status] ?? PAYMENT_STATUS_LABELS[debt.paymentStatus]}
        </StatusPill>
      ),
    },
    {
      header: "",
      className: "text-right",
      cell: (debt) =>
        debt.sourceDocumentId ? (
          <Link
            href={`/ia/document/${debt.sourceDocumentId}`}
            className="text-xs font-bold"
            style={{ color: "var(--blue-600)" }}
          >
            Fiche Doc →
          </Link>
        ) : (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            —
          </span>
        ),
    },
  ];

  const tabs = [
    { href: "/budget/dettes?view=all", label: "Toutes", count: allDebtItems.length },
    { href: "/budget/dettes?view=overdue", label: "En retard", count: overdueItems.length },
    { href: "/budget/dettes?view=upcoming", label: "À venir", count: upcomingItems.length },
    { href: "/budget/dettes?view=manual", label: "Manuelles", count: legacyDebts.length },
  ];
  const activeHref = `/budget/dettes?view=${view}`;

  const filteredItems =
    view === "overdue"
      ? overdueItems
      : view === "upcoming"
      ? upcomingItems
      : view === "manual"
      ? []
      : allDebtItems;

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { href: "/budget", label: "Budget" },
          { label: "Dettes & Échéances" },
        ]}
        backLink={{ href: "/budget", label: "Retour au budget" }}
        title="Dettes & Échéances"
        description="Surveillez vos dettes et échéances : retards, à venir, contrôle des suggestions IA."
        actions={
          <>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <Filter className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Filtres
            </button>
            <AddDebtModal />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total restant dû"
          value={formatMoney(outstanding)}
          helper="cumul toutes dettes"
          icon={Coins}
          tone="amber"
        />
        <StatCard
          label="À venir"
          value={formatMoney(upcomingTotal)}
          helper={`${upcomingItems.length} échéance(s)`}
          icon={CalendarClock}
          tone="blue"
        />
        <StatCard
          label="En retard"
          value={formatMoney(overdueTotal)}
          helper={`${overdueItems.length} item(s) à régulariser`}
          icon={AlertTriangle}
          tone={overdueItems.length > 0 ? "rose" : "slate"}
        />
        <StatCard
          label="Paiements ce mois"
          value={formatMoney(paidThisMonth)}
          helper="déjà réglés"
          icon={Wallet}
          tone="emerald"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs tabs={tabs} activeHref={activeHref} />
        <Link
          href="/budget/echeances"
          className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          <CalendarClock className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Vue calendrier
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="space-y-5">
          {view === "manual" ? (
            <SectionCard
              title={`Dettes manuelles (${legacyDebts.length})`}
              description="Saisies à la main via le bouton « Ajouter dette »."
              bodyClassName={legacyDebts.length === 0 ? "" : "p-5"}
            >
              {legacyDebts.length === 0 ? (
                <EmptyState
                  icon={Plus}
                  title="Aucune dette manuelle"
                  description="Cliquez sur « Ajouter dette » dans l'en-tête pour en créer une."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {legacyDebts.map((debt) => {
                    const progress =
                      debt.initialAmount > 0
                        ? Math.round(
                            ((debt.initialAmount - debt.remainingAmount) / debt.initialAmount) *
                              100
                          )
                        : 0;
                    return (
                      <Link
                        key={debt.id}
                        href={`/budget/dettes/${debt.id}`}
                        className="rounded-2xl bg-white p-4 transition hover:shadow-md"
                        style={{
                          border: "1px solid var(--border)",
                          boxShadow: "0 1px 8px -2px rgba(8,18,37,0.06)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>
                              {debt.label}
                            </p>
                            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                              {debt.creditor}
                            </p>
                          </div>
                          <StatusPill
                            tone={
                              debt.status === "settled"
                                ? "emerald"
                                : debt.status === "overdue"
                                ? "rose"
                                : "amber"
                            }
                            dot
                          >
                            {debt.status}
                          </StatusPill>
                        </div>
                        <div
                          className="mt-3 h-1.5 overflow-hidden rounded-full"
                          style={{ background: "rgba(11,92,255,0.08)" }}
                        >
                          <div
                            className="h-full"
                            style={{
                              background: "linear-gradient(90deg, #16A34A 0%, #15803D 100%)",
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                          Restant :{" "}
                          <strong style={{ color: "var(--text-main)" }}>
                            {formatMoney(debt.remainingAmount, debt.currency)}
                          </strong>{" "}
                          sur {formatMoney(debt.initialAmount, debt.currency)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          ) : (
            <>
              {view === "all" || view === "upcoming" ? (
                <SectionCard
                  title={`À venir (${upcomingItems.length})`}
                  description="Échéances dans les 30 prochains jours."
                  bodyClassName=""
                >
                  {upcomingItems.length === 0 ? (
                    <EmptyState
                      icon={CalendarClock}
                      title="Aucune échéance à venir"
                      description="Tout est à jour."
                    />
                  ) : (
                    <DataTable
                      rows={upcomingItems.slice(0, 10)}
                      columns={debtColumns}
                      getRowKey={(i) => i.id}
                    />
                  )}
                </SectionCard>
              ) : null}

              {view === "all" || view === "overdue" ? (
                <SectionCard
                  title={`En retard (${overdueItems.length})`}
                  description="Échéances dépassées non réglées."
                  bodyClassName=""
                >
                  {overdueItems.length === 0 ? (
                    <EmptyState
                      icon={AlertTriangle}
                      title="Aucune dette en retard"
                      description="Continuez comme ça."
                    />
                  ) : (
                    <DataTable
                      rows={overdueItems.slice(0, 10)}
                      columns={debtColumns}
                      getRowKey={(i) => i.id}
                    />
                  )}
                </SectionCard>
              ) : null}

              {view === "all" ? (
                <SectionCard
                  title={`Toutes les dettes (${allDebtItems.length})`}
                  description="Toutes les dettes détectées par IA et leurs statuts."
                  bodyClassName=""
                >
                  {allDebtItems.length === 0 ? (
                    <EmptyState
                      icon={Coins}
                      title="Aucune dette détectée"
                      description="Analysez vos documents financiers pour générer des suggestions."
                    />
                  ) : (
                    <DataTable
                      rows={allDebtItems.slice(0, 20)}
                      columns={debtColumns}
                      getRowKey={(i) => i.id}
                    />
                  )}
                </SectionCard>
              ) : null}

              {view === "overdue" || view === "upcoming" ? null : null}
              {view !== "all" && view !== "overdue" && view !== "upcoming" && view !== "manual" ? (
                <SectionCard
                  title="Filtrer"
                  description="Choisissez un filtre dans la barre ci-dessus."
                >
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Sélectionnez « Toutes », « En retard », « À venir » ou « Manuelles » pour voir
                    le détail.
                  </p>
                </SectionCard>
              ) : null}

              {view === "upcoming" || view === "overdue" ? (
                <SectionCard
                  title={`Toutes les dettes (${allDebtItems.length})`}
                  description="Vue complète de toutes les dettes détectées."
                  bodyClassName=""
                >
                  {filteredItems === allDebtItems ? null : null}
                  {allDebtItems.length === 0 ? (
                    <EmptyState
                      icon={Coins}
                      title="Aucune dette détectée"
                      description="Analysez vos documents financiers pour générer des suggestions."
                    />
                  ) : (
                    <DataTable
                      rows={allDebtItems.slice(0, 20)}
                      columns={debtColumns}
                      getRowKey={(i) => i.id}
                    />
                  )}
                </SectionCard>
              ) : null}
            </>
          )}
        </div>

        <aside className="space-y-5">
          <RightRailCard
            title="Ajouter un paiement"
            icon={Plus}
            iconTone="blue"
          >
            <p className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
              Sélectionnez la dette à laquelle ce paiement doit être imputé puis enregistrez le
              montant et la date.
            </p>
            <Link
              href="/budget/depenses"
              className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--blue-600)" }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              Enregistrer un paiement
            </Link>
            <Link
              href="/budget/echeances"
              className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              Voir le calendrier
              <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </Link>
          </RightRailCard>

          <RightRailCard title="Conseils" icon={AlertTriangle} iconTone="amber">
            <ul className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--blue-600)" }}
                />
                Les dettes issues de l&apos;IA arrivent en statut « à contrôler ».
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--blue-600)" }}
                />
                Cliquez sur « Fiche Doc » pour ajuster la suggestion.
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--blue-600)" }}
                />
                Les paiements partiels mettent à jour le restant dû.
              </li>
            </ul>
          </RightRailCard>
        </aside>
      </div>
    </PageShell>
  );
}
