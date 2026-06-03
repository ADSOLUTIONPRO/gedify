import type { ReactNode } from "react";

type Tone = "blue" | "violet" | "emerald" | "amber" | "rose" | "slate" | "orange";

const TONE: Record<Tone, { bg: string; color: string }> = {
  blue: { bg: "rgba(11,92,255,0.10)", color: "#0B5CFF" },
  violet: { bg: "rgba(124,58,237,0.12)", color: "#7C3AED" },
  emerald: { bg: "rgba(16,163,74,0.12)", color: "#16A34A" },
  amber: { bg: "rgba(245,158,11,0.14)", color: "#B45309" },
  rose: { bg: "rgba(239,68,68,0.10)", color: "#DC2626" },
  slate: { bg: "rgba(100,116,139,0.10)", color: "#475569" },
  orange: { bg: "rgba(249,115,22,0.14)", color: "#EA580C" },
};

type StatusPillProps = {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
};

export function StatusPill({ tone = "slate", children, className = "", dot }: StatusPillProps) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}
      style={{ background: t.bg, color: t.color }}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: t.color }}
        />
      ) : null}
      {children}
    </span>
  );
}
