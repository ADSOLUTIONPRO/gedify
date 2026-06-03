import type { ReactNode } from "react";

export type CompactListItem = {
  id: string | number;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  isActive?: boolean;
  onClick?: () => void;
};

type CompactListProps = {
  items: CompactListItem[];
  empty?: ReactNode;
};

export function CompactList({ items, empty }: CompactListProps) {
  if (items.length === 0) {
    return <>{empty ?? null}</>;
  }

  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-sm backdrop-blur">
      {items.map((item) => {
        const className = `flex min-h-[72px] items-center gap-3 px-4 py-3 text-left transition ${
          item.isActive ? "bg-blue-50/80" : "hover:bg-slate-50"
        }`;
        const content = (
          <>
            {item.leading ? <div className="shrink-0">{item.leading}</div> : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold text-slate-950">{item.title}</div>
              {item.subtitle ? (
                <div className="mt-0.5 truncate text-xs font-medium text-slate-500">
                  {item.subtitle}
                </div>
              ) : null}
              {item.meta ? <div className="mt-1 flex flex-wrap gap-1.5">{item.meta}</div> : null}
            </div>
            {item.trailing ? <div className="shrink-0">{item.trailing}</div> : null}
          </>
        );

        if (item.href) {
          return (
            <a key={item.id} href={item.href} className={className}>
              {content}
            </a>
          );
        }

        if (item.onClick) {
          return (
            <button key={item.id} type="button" onClick={item.onClick} className={`w-full ${className}`}>
              {content}
            </button>
          );
        }

        return (
          <div key={item.id} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
