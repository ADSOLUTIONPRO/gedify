import { ChevronRight, Code2 } from "lucide-react";
import type { ReactNode } from "react";

type TechnicalAccordionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function TechnicalAccordion({
  title,
  description,
  defaultOpen = false,
  children,
}: TechnicalAccordionProps) {
  return (
    <details
      className="group rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Code2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="flex-1">
          <span className="block">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs font-normal text-slate-500">{description}</span>
          ) : null}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90"
          strokeWidth={1.75}
        />
      </summary>
      <div className="border-t border-slate-100 px-4 py-4">{children}</div>
    </details>
  );
}
