import type { ReactNode } from "react";

export type MetadataItem = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
};

type MetadataGridProps = {
  items: MetadataItem[];
  columns?: 1 | 2 | 3 | 4;
};

const COLUMN_CLASSES: Record<1 | 2 | 3 | 4, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function MetadataGrid({ items, columns = 2 }: MetadataGridProps) {
  return (
    <dl className={`grid gap-3 ${COLUMN_CLASSES[columns]}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-200/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur"
        >
          <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {item.icon ? <span className="text-slate-400">{item.icon}</span> : null}
            {item.label}
          </dt>
          <dd className="mt-1.5 text-sm font-semibold text-slate-900 break-words">
            {item.value === null || item.value === undefined || item.value === "" ? (
              <span className="text-slate-400">Non renseigné</span>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
