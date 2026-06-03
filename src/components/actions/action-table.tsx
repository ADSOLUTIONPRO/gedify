import Link from "next/link";
import { CalendarDays, FileText, Zap } from "lucide-react";
import { ActionStatusBadge } from "./action-status-badge";
import { ActionPriorityBadge } from "./action-priority-badge";
import { ACTION_TYPE_LABELS, type ActionItem } from "@/lib/actions/types";

export function ActionTable({ items }: { items: ActionItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Action</th>
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Priorité</th>
            <th className="px-5 py-3">Statut</th>
            <th className="px-5 py-3">Échéance</th>
            <th className="px-5 py-3">Montant</th>
            <th className="px-5 py-3 text-right">Détail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="transition hover:bg-slate-50/60">
              <td className="px-5 py-4 align-top">
                <div className="flex items-start gap-2">
                  {item.createdFrom === "ai" ? (
                    <span
                      title="Générée par l'IA"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"
                    >
                      <Zap className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    {item.documentIds.length > 0 ? (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                        <FileText className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                        Document(s) {item.documentIds.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-5 py-4 align-top text-xs font-semibold text-slate-700">
                {ACTION_TYPE_LABELS[item.type]}
              </td>
              <td className="px-5 py-4 align-top">
                <ActionPriorityBadge priority={item.priority} />
              </td>
              <td className="px-5 py-4 align-top">
                <ActionStatusBadge status={item.status} />
              </td>
              <td className="px-5 py-4 align-top text-xs font-medium text-slate-700">
                {item.dueDate ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    {new Date(item.dueDate).toLocaleDateString("fr-FR")}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-5 py-4 align-top text-xs font-semibold text-slate-800">
                {item.amount ? `${item.amount.toFixed(2)} ${item.currency ?? "€"}` : <span className="text-slate-400">—</span>}
              </td>
              <td className="px-5 py-4 align-top text-right">
                <Link
                  href={`/actions/${item.id}`}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  Ouvrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
