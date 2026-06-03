import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

type MoreActionsMenuProps = {
  children: ReactNode;
  label?: string;
};

export function MoreActionsMenu({ children, label = "Plus" }: MoreActionsMenuProps) {
  return (
    <details className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        {label}
      </summary>
      <div className="absolute right-0 z-20 mt-2 min-w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
        <div className="grid gap-1">{children}</div>
      </div>
    </details>
  );
}
