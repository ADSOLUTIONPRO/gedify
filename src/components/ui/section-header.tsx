import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  /** Lightweight title used between sections — smaller than PageHeader. */
};

export function SectionHeader({ title, description, icon: Icon, actions }: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="flex items-center gap-2">
        {Icon ? (
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
        ) : null}
        <div>
          <p className="text-sm font-extrabold tracking-tight text-slate-900">{title}</p>
          {description ? (
            <p className="text-xs text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}
