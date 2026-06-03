import { Layers } from "lucide-react";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { listCategories } from "@/lib/budget/budget-store";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategories();
  const revenues = categories.filter((entry) => entry.type === "revenue");
  const expenses = categories.filter((entry) => entry.type === "expense");
  const debts = categories.filter((entry) => entry.type === "debt");

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/budget", label: "Budget" }}
        eyebrow="Budget"
        title="Catégories"
        description={`${categories.length} catégorie(s) configurée(s).`}
      />

      <div className="mb-6">
        <HelpCard
          tone="violet"
          icon={Layers}
          title="À quoi servent les catégories ?"
          description="Une catégorie regroupe des revenus ou des dépenses d'un même type (Logement, Énergie, Salaire…). Elles permettent les rapports par axe et les budgets mensuels."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Group title="Revenus" items={revenues} />
        <Group title="Dépenses" items={expenses} />
        <Group title="Dettes" items={debts} />
      </div>
    </main>
  );
}

function Group({
  title,
  items,
}: {
  title: string;
  items: import("@/lib/budget/types").BudgetCategory[];
}) {
  return (
    <SectionCard title={title} bodyClassName="">
      {items.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">Aucune catégorie.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {category.name}
                  </p>
                  <p className="text-[11px] text-slate-500">{category.icon}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-slate-600">
                {category.monthlyBudget > 0 ? `${category.monthlyBudget} €` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
