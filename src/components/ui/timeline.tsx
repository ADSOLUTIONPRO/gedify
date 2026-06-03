import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleDot } from "lucide-react";

export type TimelineItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  time?: ReactNode;
  date?: string;
  href?: string;
  icon?: LucideIcon;
  tone?: "blue" | "green" | "amber" | "red" | "violet" | "slate";
  details?: ReactNode;
};

const TONE = {
  blue: "bg-blue-50 text-blue-600 ring-blue-100",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  red: "bg-rose-50 text-rose-600 ring-rose-100",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
} as const;

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item) => {
        const Icon = item.icon ?? CircleDot;
        const body = (
          <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${TONE[item.tone ?? "slate"]}`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-extrabold text-slate-950">{item.title}</p>
                {item.time ? <span className="text-[11px] font-medium text-slate-400">{item.time}</span> : null}
              </div>
              {item.description ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.description}</p> : null}
              {item.details ? <div className="mt-2">{item.details}</div> : null}
            </div>
          </div>
        );

        return item.href ? (
          <li key={item.id}>
            <a href={item.href}>{body}</a>
          </li>
        ) : (
          <li key={item.id}>{body}</li>
        );
      })}
    </ol>
  );
}
