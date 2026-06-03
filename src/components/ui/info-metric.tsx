import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type InfoMetricTone = "neutral" | "blue" | "green" | "amber" | "red" | "violet";

type Props = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: LucideIcon;
  tone?: InfoMetricTone;
  /** Optional trend hint, e.g. "+12%" or "-5 €". Rendered as a chip. */
  trend?: string;
  /**
   * Si `false` (par défaut), affichage dense optimisé pour KPI répétés.
   * Si `true`, affichage encore plus minimaliste pour listes denses.
   */
  compact?: boolean;
};

const TONE: Record<InfoMetricTone, { bg: string; color: string }> = {
  neutral: { bg: "rgba(100,116,139,0.10)", color: "#475569" },
  blue: { bg: "rgba(11,92,255,0.10)", color: "#0B5CFF" },
  green: { bg: "rgba(16,163,74,0.12)", color: "#16A34A" },
  amber: { bg: "rgba(245,158,11,0.14)", color: "#D97706" },
  red: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
  violet: { bg: "rgba(124,58,237,0.12)", color: "#7C3AED" },
};

export function InfoMetric({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue",
  trend,
  compact,
}: Props) {
  const t = TONE[tone];
  return (
    <div
      className={`rounded-xl bg-white ${compact ? "p-2" : "p-2.5"}`}
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 1px 6px -3px rgba(8,18,37,0.06)",
      }}
    >
      <div className="flex items-center gap-2">
        {Icon ? (
          <span
            aria-hidden="true"
            className={`flex shrink-0 items-center justify-center rounded-lg ${
              compact ? "h-6 w-6" : "h-7 w-7"
            }`}
            style={{ background: t.bg, color: t.color }}
          >
            <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={1.75} />
          </span>
        ) : null}
        <span
          className="text-[10px] font-bold uppercase tracking-[0.08em] flex-1 truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
        {trend ? (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
            style={{ background: t.bg, color: t.color }}
          >
            {trend}
          </span>
        ) : null}
      </div>
      <p
        className={`mt-1 font-extrabold tracking-tight leading-none ${
          compact ? "text-base" : "text-lg"
        }`}
        style={{ color: "var(--text-main)" }}
      >
        {value}
      </p>
      {helper ? (
        <p
          className="mt-0.5 truncate text-[10px] leading-tight"
          style={{ color: "var(--text-muted)" }}
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}
