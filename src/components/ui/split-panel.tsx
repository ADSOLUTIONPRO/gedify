import type { ReactNode } from "react";

type SplitPanelProps = {
  left: ReactNode;
  right: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
};

export function SplitPanel({ left, right, leftLabel, rightLabel }: SplitPanelProps) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.35fr)]">
      <div className="min-w-0">
        {leftLabel ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            {leftLabel}
          </p>
        ) : null}
        {left}
      </div>
      <div className="min-w-0">
        {rightLabel ? (
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            {rightLabel}
          </p>
        ) : null}
        {right}
      </div>
    </section>
  );
}
