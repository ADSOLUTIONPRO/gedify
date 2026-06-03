import type { ReactNode } from "react";

type FilterBarProps = {
  children: ReactNode;
  actionLabel?: string;
  resetHref?: string;
};

export function FilterBar({ children, actionLabel = "Appliquer", resetHref }: FilterBarProps) {
  return (
    <div
      className="rounded-2xl bg-white p-4"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 2px 14px -6px rgba(8,18,37,0.06)",
      }}
    >
      <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
        <div className="grid gap-4 lg:col-span-10 lg:grid-cols-4">{children}</div>
        <div className="flex gap-2 lg:col-span-2">
          <button
            type="submit"
            className="h-10 flex-1 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{
              background: "var(--blue-600)",
              boxShadow: "0 6px 16px -6px rgba(11,92,255,0.45)",
            }}
          >
            {actionLabel}
          </button>
          {resetHref ? (
            <a
              href={resetHref}
              className="inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition hover:bg-slate-50"
              style={{
                borderColor: "var(--border)",
                background: "white",
                color: "var(--text-muted)",
              }}
            >
              Effacer
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
