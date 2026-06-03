import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import type { DueItem } from "@/lib/budget/types";

export function DueItemsTable({ items }: { items: DueItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Échéance</th>
            <th className="px-5 py-3">Libellé</th>
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3 text-right">Montant</th>
            <th className="px-5 py-3 text-right">Statut</th>
            <th className="px-5 py-3 text-right">Lien</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const overdue = item.status === "overdue";
            return (
              <tr key={item.id} className="transition hover:bg-slate-50/60">
                <td className="px-5 py-4 align-top text-xs font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1.5">
                    {overdue ? (
                      <AlertTriangle className="h-3 w-3 text-rose-600" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <CalendarClock className="h-3 w-3 text-blue-500" strokeWidth={2} aria-hidden="true" />
                    )}
                    {new Date(item.dueDate).toLocaleDateString("fr-FR")}
                  </span>
                </td>
                <td className="px-5 py-4 align-top text-sm font-semibold text-slate-900">
                  {item.label}
                </td>
                <td className="px-5 py-4 align-top text-xs font-medium text-slate-700">
                  {item.kind === "expense" ? "Dépense" : item.kind === "debt" ? "Dette" : "Action"}
                </td>
                <td className="px-5 py-4 align-top text-right text-sm font-semibold text-slate-800">
                  {item.amount !== null ? `${item.amount.toFixed(2)} ${item.currency ?? "€"}` : "—"}
                </td>
                <td className="px-5 py-4 align-top text-right">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      overdue
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-blue-200 bg-blue-50 text-blue-700"
                    }`}
                  >
                    {overdue ? "En retard" : "À venir"}
                  </span>
                </td>
                <td className="px-5 py-4 align-top text-right">
                  {item.kind === "debt" && item.refId ? (
                    <Link href={`/budget/dettes/${item.refId}`} className="text-xs font-semibold text-blue-700 hover:underline">
                      Ouvrir
                    </Link>
                  ) : item.kind === "expense" ? (
                    <Link href="/budget/depenses" className="text-xs font-semibold text-blue-700 hover:underline">
                      Voir
                    </Link>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
