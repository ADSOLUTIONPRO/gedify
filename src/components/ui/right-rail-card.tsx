import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type RightRailCardProps = {
  title?: string;
  icon?: LucideIcon;
  iconTone?: "blue" | "violet" | "emerald" | "amber" | "rose";
  ctaLabel?: string;
  ctaHref?: string;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
};

const TONE: Record<
  NonNullable<RightRailCardProps["iconTone"]>,
  { bg: string; color: string }
> = {
  blue: { bg: "rgba(11,92,255,0.10)", color: "#0B5CFF" },
  violet: { bg: "rgba(124,58,237,0.12)", color: "#7C3AED" },
  emerald: { bg: "rgba(16,163,74,0.12)", color: "#16A34A" },
  amber: { bg: "rgba(245,158,11,0.14)", color: "#D97706" },
  rose: { bg: "rgba(239,68,68,0.12)", color: "#EF4444" },
};

export function RightRailCard({
  title,
  icon: Icon,
  iconTone = "blue",
  ctaLabel,
  ctaHref,
  children,
  bodyClassName = "",
  className = "",
}: RightRailCardProps) {
  const t = TONE[iconTone];
  return (
    <div
      className={`rounded-2xl bg-white p-5 ${className}`}
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 2px 16px -6px rgba(8,18,37,0.07)",
      }}
    >
      {(title || ctaHref) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {Icon ? (
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: t.bg, color: t.color }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
            ) : null}
            {title ? (
              <h3
                className="text-sm font-extrabold tracking-tight truncate"
                style={{ color: "var(--text-main)" }}
              >
                {title}
              </h3>
            ) : null}
          </div>
          {ctaHref && ctaLabel ? (
            <Link
              href={ctaHref}
              className="shrink-0 text-xs font-semibold transition hover:opacity-80"
              style={{ color: "var(--blue-600)" }}
            >
              {ctaLabel}
            </Link>
          ) : null}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
