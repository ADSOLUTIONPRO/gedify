import { TrendingUp } from "lucide-react";
import { AddRevenueModal } from "@/components/budget/add-revenue-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { listRevenues } from "@/lib/budget/budget-store";

export const dynamic = "force-dynamic";

export default async function RevenuesPage() {
  const items = await listRevenues();
  const total = items.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Revenus"
        description={`${items.length} revenu(s) · total : ${total.toFixed(2)} €. Ajoutez un revenu manuellement ou validez une suggestion IA depuis /budget/documents.`}
        actions={<AddRevenueModal />}
      />

      <div className="mb-6">
        <HelpCard
          tone="emerald"
          icon={TrendingUp}
          title="Sources possibles"
          description="Salaire, CAF, CPAM, remboursement, indemnité, aide sociale, virement, autre. Les revenus peuvent être ponctuels ou récurrents."
        />
      </div>

      <SectionCard bodyClassName={items.length === 0 ? "p-5" : ""}>
        {items.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Aucun revenu enregistré"
            description="Ajoutez votre premier revenu ou validez une suggestion depuis une analyse IA."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Libellé</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Récurrence</th>
                  <th className="px-5 py-3 text-right">Montant</th>
                  <th className="px-5 py-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((revenue) => (
                  <tr key={revenue.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4 align-top text-sm font-semibold text-slate-900">
                      {revenue.label}
                    </td>
                    <td className="px-5 py-4 align-top text-xs text-slate-700">{revenue.source}</td>
                    <td className="px-5 py-4 align-top text-xs text-slate-700">
                      {new Date(revenue.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-5 py-4 align-top text-xs text-slate-700">
                      {revenue.recurrence}
                    </td>
                    <td className="px-5 py-4 align-top text-right text-sm font-semibold text-emerald-700">
                      {revenue.amount.toFixed(2)} {revenue.currency}
                    </td>
                    <td className="px-5 py-4 align-top text-right">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        {revenue.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </main>
  );
}
