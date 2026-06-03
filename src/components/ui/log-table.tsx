import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { CollapsibleDetails } from "@/components/ui/collapsible-details";

type LogLevel = "info" | "success" | "warning" | "error";

export type LogRow = {
  id: string;
  level: LogLevel;
  source: string;
  message: string;
  date: string;
  details?: string;
};

const LEVEL = {
  info: { icon: Info, label: "Info", className: "bg-blue-50 text-blue-700 ring-blue-100" },
  success: {
    icon: CheckCircle2,
    label: "Succès",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  warning: {
    icon: AlertTriangle,
    label: "Avertissement",
    className: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  error: { icon: XCircle, label: "Erreur", className: "bg-rose-50 text-rose-700 ring-rose-100" },
} as const;

export function LogTable({ rows }: { rows: LogRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5">Niveau</th>
            <th className="px-4 py-2.5">Source</th>
            <th className="px-4 py-2.5">Message</th>
            <th className="px-4 py-2.5">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const level = LEVEL[row.level];
            const Icon = level.icon;
            return (
              <tr key={row.id} className="align-top">
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${level.className}`}>
                    <Icon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                    {level.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs font-semibold text-slate-500">{row.source}</td>
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-slate-900">{row.message}</p>
                  {row.details ? (
                    <div className="mt-2">
                      <CollapsibleDetails title="Voir détails techniques">
                        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">
                          {row.details}
                        </pre>
                      </CollapsibleDetails>
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{row.date}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
