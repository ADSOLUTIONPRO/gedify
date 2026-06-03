import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, CircleDot, Clock3 } from "lucide-react";

export type SetupStepStatus = "todo" | "in-progress" | "done";

type SetupStepCardProps = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  status: SetupStepStatus;
  icon: LucideIcon;
};

const STATUS_LABEL: Record<SetupStepStatus, string> = {
  todo: "À faire",
  "in-progress": "En cours",
  done: "Terminé",
};

const STATUS_ICON: Record<SetupStepStatus, LucideIcon> = {
  todo: CircleDot,
  "in-progress": Clock3,
  done: CheckCircle2,
};

const STATUS_CLASS: Record<SetupStepStatus, string> = {
  todo: "bg-slate-50 text-slate-600 ring-slate-200",
  "in-progress": "bg-amber-50 text-amber-700 ring-amber-100",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-100",
};

export function SetupStepCard({
  title,
  description,
  href,
  actionLabel,
  status,
  icon: Icon,
}: SetupStepCardProps) {
  const StatusIcon = STATUS_ICON[status];

  return (
    <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-extrabold text-slate-950">{title}</h3>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${STATUS_CLASS[status]}`}
          >
            <StatusIcon className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {STATUS_LABEL[status]}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{description}</p>
      </div>
      <Link href={href} className="shrink-0 text-xs font-bold text-blue-700 hover:underline">
        {actionLabel}
      </Link>
    </article>
  );
}
