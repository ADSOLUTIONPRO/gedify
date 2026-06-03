import type { ReactNode } from "react";

export function CompactToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm backdrop-blur">
      {children}
    </div>
  );
}
