import Link from "next/link";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type FilterChipTone = "blue" | "violet" | "emerald" | "amber" | "rose" | "slate";

const CHIP_TONE: Record<FilterChipTone, { bg: string; color: string; border: string }> = {
  blue: {
    bg: "rgba(11,92,255,0.08)",
    color: "#0B5CFF",
    border: "rgba(11,92,255,0.18)",
  },
  violet: {
    bg: "rgba(124,58,237,0.10)",
    color: "#7C3AED",
    border: "rgba(124,58,237,0.18)",
  },
  emerald: {
    bg: "rgba(16,163,74,0.10)",
    color: "#16A34A",
    border: "rgba(16,163,74,0.18)",
  },
  amber: {
    bg: "rgba(245,158,11,0.12)",
    color: "#B45309",
    border: "rgba(245,158,11,0.22)",
  },
  rose: {
    bg: "rgba(239,68,68,0.10)",
    color: "#DC2626",
    border: "rgba(239,68,68,0.18)",
  },
  slate: {
    bg: "rgba(100,116,139,0.10)",
    color: "#475569",
    border: "rgba(100,116,139,0.18)",
  },
};

type FilterChipProps = {
  label: ReactNode;
  tone?: FilterChipTone;
  removeHref?: string;
  className?: string;
};

export function FilterChip({
  label,
  tone = "slate",
  removeHref,
  className = "",
}: FilterChipProps) {
  const t = CHIP_TONE[tone];

  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-full pl-2.5 pr-1 text-[12px] font-semibold ${className}`}
      style={{
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
      }}
    >
      <span className={removeHref ? "pr-1" : "pr-2"}>{label}</span>
      {removeHref ? (
        <Link
          href={removeHref}
          aria-label="Retirer le filtre"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full transition hover:opacity-70"
          style={{ background: "rgba(0,0,0,0.06)", color: t.color }}
        >
          <X className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        </Link>
      ) : null}
    </span>
  );
}
