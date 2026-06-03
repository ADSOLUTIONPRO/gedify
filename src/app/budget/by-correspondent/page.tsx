import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { CompactEmptyState } from "@/components/ui/compact-empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  getAllCorrespondentsFinancialSummary,
  getCorrespondentFinancialSummary,
} from "@/lib/budget/budget-calculations";
import { formatMoney } from "@/lib/format-money";
import {
  KIND_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/budget/financial-item-types";
import { firstParam, type PageSearchParams } from "@/lib/page-params";

export const dynamic = "force-dynamic";

export default async function ByCorrespondentPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const focusIdRaw = firstParam(params, "correspondentId");
  const focusId = focusIdRaw ? Number.parseInt(focusIdRaw, 10) : null;

  const [all, focus] = await Promise.all([
    getAllCorrespondentsFinancialSummary(),
    focusId && Number.isFinite(focusId)
      ? getCorrespondentFinancialSummary(focusId)
      : Promise.resolve(null),
  ]);

  return (
    <main className="p-4 lg:p-6">
      <PageHeader
        compact
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Sommes par correspondant"
        description="Pour chaque organisme ou personne : total détecté, payé, restant et prochaines échéances."
      />

      <HelpCard
        compact
        tone="blue"
        icon={Users}
        title="Comment c'est calculé"
        description="Toutes les sommes détectées par l'IA et validées dans le budget sont regroupées par correspondant. Les éléments rejetés ou ignorés ne comptent pas."
        className="mb-4"
      />

      {focus ? (
        <SectionCard
          icon={Users}
          title={focus.summary?.correspondentName ?? "Correspondant"}
          description={focus.summary
            ? `${focus.summary.itemCount} document(s) · prochaine échéance ${
                focus.summary.nextDueDate
                  ? new Date(focus.summary.nextDueDate).toLocaleDateString("fr-FR")
                  : "—"
              }`
            : "Sans données"}
          actions={
            <Link
              href="/budget/by-correspondent"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-700"
            >
              Retirer le filtre
              <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </Link>
          }
          className="mb-4"
        >
          {focus.items.length === 0 ? (
            <CompactEmptyState
              icon={Users}
              title="Aucun item financier"
              description="Aucune somme validée pour ce correspondant."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {focus.items.map((item) => (
                <li key={item.id} className="grid gap-1 py-2 text-xs sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {KIND_LABELS[item.kind]}
                      {item.budgetMonth ? ` · ${item.budgetMonth}` : ""}
                      {item.dueDate
                        ? ` · échéance ${new Date(item.dueDate).toLocaleDateString("fr-FR")}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-right text-xs text-slate-500">
                    {PAYMENT_STATUS_LABELS[item.paymentStatus]}
                  </span>
                  <span className="text-right text-sm font-bold text-slate-900">
                    {formatMoney(
                      item.direction === "outgoing"
                        ? item.amountRemaining ?? item.amount
                        : item.amount,
                      item.currency,
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        icon={Users}
        title={`Tous les correspondants (${all.length})`}
        description="Triés par reste à payer décroissant."
        bodyClassName=""
      >
        {all.length === 0 ? (
          <div className="p-4">
            <CompactEmptyState
              icon={Users}
              title="Aucun correspondant pour l'instant"
              description="Validez des suggestions IA depuis /ia/document/[id] pour alimenter ce tableau."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Correspondant</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-right">Payé</th>
                  <th className="px-4 py-2.5 text-right">Restant</th>
                  <th className="px-4 py-2.5 text-right">En retard</th>
                  <th className="px-4 py-2.5">Échéance</th>
                  <th className="px-4 py-2.5 text-right">Docs</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {all.map((entry, index) => {
                  const href = entry.correspondentId
                    ? `/budget/by-correspondent?correspondentId=${entry.correspondentId}`
                    : "/budget/by-correspondent";
                  return (
                    <tr
                      key={`${entry.correspondentId ?? entry.correspondentName}-${index}`}
                      className="transition hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {entry.correspondentName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {entry.kinds.slice(0, 3).map((kind) => (
                            <span key={kind} className="mr-1.5 inline-block">
                              {KIND_LABELS[kind as keyof typeof KIND_LABELS] ?? kind}
                            </span>
                          ))}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">
                        {formatMoney(entry.total)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-700">
                        {formatMoney(entry.paid)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-amber-700">
                        {formatMoney(entry.remaining)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right text-xs font-semibold ${
                          entry.overdue > 0 ? "text-rose-700" : "text-slate-400"
                        }`}
                      >
                        {entry.overdue > 0 ? formatMoney(entry.overdue) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {entry.nextDueDate
                          ? new Date(entry.nextDueDate).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        {entry.itemCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Détail
                          <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </main>
  );
}
