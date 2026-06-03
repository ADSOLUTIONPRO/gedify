import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type StatusBadgeProps = {
  label: ReactNode;
  tone?: "slate" | "blue" | "emerald" | "amber" | "rose" | "violet";
  icon?: LucideIcon;
  className?: string;
};

const TONES = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
} as const;

export function StatusBadge({
  label,
  tone = "slate",
  icon: Icon,
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONES[tone]} ${className}`}
    >
      {Icon ? <Icon className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> : null}
      {label}
    </span>
  );
}
