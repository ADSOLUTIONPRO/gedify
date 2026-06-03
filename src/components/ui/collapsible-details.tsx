import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type CollapsibleDetailsProps = {
  title?: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function CollapsibleDetails({
  title = "Voir détails",
  children,
  defaultOpen = false,
}: CollapsibleDetailsProps) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-slate-200 bg-slate-50/60"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-slate-600">
        {title}
        <ChevronDown
          className="h-3.5 w-3.5 transition group-open:rotate-180"
          strokeWidth={2}
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-slate-200 px-3 py-3 text-xs leading-5 text-slate-600">
        {children}
      </div>
    </details>
  );
}
