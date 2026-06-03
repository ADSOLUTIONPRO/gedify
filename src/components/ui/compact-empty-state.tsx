import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
};

export function CompactEmptyState({ title, description, icon: Icon = Inbox, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-400 ring-1 ring-inset ring-slate-200"
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <p className="text-sm font-bold text-slate-800">{title}</p>
      {description ? (
        <p className="max-w-md text-xs leading-5 text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
