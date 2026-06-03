import { Receipt } from "lucide-react";
import { AddExpenseModal } from "@/components/budget/add-expense-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { listExpenses } from "@/lib/budget/budget-store";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const items = await listExpenses();
  const total = items.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Dépenses"
        description={`${items.length} dépense(s) · total : ${total.toFixed(2)} €. Loyer, factures, abonnements, charges.`}
        actions={<AddExpenseModal />}
      />

      <div className="mb-6">
        <HelpCard
          tone="violet"
          icon={Receipt}
          title="Catégories disponibles"
          description="Logement, énergie, eau, télécom, assurance, transport, santé, impôts, banque, alimentation, famille, juridique, travaux, entreprise."
        />
      </div>

      <SectionCard bodyClassName={items.length === 0 ? "p-5" : ""}>
        {items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Aucune dépense enregistrée"
            description="Validez une suggestion IA depuis /budget/documents pour démarrer rapidement."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Libellé</th>
                  <th className="px-5 py-3">Bénéficiaire</th>
                  <th className="px-5 py-3">Catégorie</th>
                  <th className="px-5 py-3">Échéance</th>
                  <th className="px-5 py-3 text-right">Montant</th>
                  <th className="px-5 py-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((expense) => (
                  <tr key={expense.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4 align-top text-sm font-semibold text-slate-900">
                      {expense.label}
                    </td>
                    <td className="px-5 py-4 align-top text-xs text-slate-700">{expense.payee}</td>
                    <td className="px-5 py-4 align-top text-xs text-slate-700">
                      {expense.category ?? "—"}
                    </td>
                    <td className="px-5 py-4 align-top text-xs text-slate-700">
                      {expense.dueDate ? new Date(expense.dueDate).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="px-5 py-4 align-top text-right text-sm font-semibold text-violet-700">
                      {expense.amount.toFixed(2)} {expense.currency}
                    </td>
                    <td className="px-5 py-4 align-top text-right">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        {expense.status}
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
