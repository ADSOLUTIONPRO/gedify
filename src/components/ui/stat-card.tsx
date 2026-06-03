import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "blue" | "violet" | "emerald" | "amber" | "rose" | "slate" | "orange";

type StatCardProps = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  trailing?: ReactNode;
};

const TONE: Record<Tone, { bg: string; color: string }> = {
  blue: { bg: "rgba(37,99,235,0.10)", color: "#2563EB" },
  violet: { bg: "rgba(124,58,237,0.12)", color: "#7C3AED" },
  emerald: { bg: "rgba(16,163,74,0.12)", color: "#16A34A" },
  amber: { bg: "rgba(245,158,11,0.14)", color: "#D97706" },
  rose: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
  slate: { bg: "rgba(100,116,139,0.12)", color: "#475569" },
  orange: { bg: "rgba(249,115,22,0.14)", color: "#EA580C" },
};

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue",
  trailing,
}: StatCardProps) {
  const t = TONE[tone];

  return (
    <div
      className="rounded-[16px] bg-white p-3"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2">
        {Icon ? (
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: t.bg, color: t.color }}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
        ) : null}
        <span
          className="flex-1 truncate text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
        {trailing ? (
          <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
            {trailing}
          </span>
        ) : null}
      </div>
      <p
        className="mt-1 text-lg font-extrabold tracking-tight leading-none"
        style={{ color: "var(--gedify-navy)" }}
      >
        {value}
      </p>
      {helper ? (
        <div
          className="mt-0.5 truncate text-[10px] leading-tight"
          style={{ color: "var(--text-muted)" }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
}
