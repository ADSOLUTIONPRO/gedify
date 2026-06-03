import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, GripVertical } from "lucide-react";
import { getSpaceById } from "@/config/spaces";

/**
 * Coque commune d'un widget de la grille (maquette v2) :
 * drag handle ⠿ + badge icône Lucide coloré + titre + "Voir tout >".
 * Accepte un `ctaHref` / `ctaLabel` pour le lien d'action en bas de carte.
 */
export function WidgetShell({
  spaceId,
  title,
  href,
  ctaLabel,
  ctaHref,
  dragHandleProps,
  tone = "elevated",
  children,
}: {
  spaceId: string;
  title: string;
  href?: string;
  ctaLabel?: string;
  ctaHref?: string;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  /** "elevated" = carte blanche en relief · "soft" = surface soutenue (KPI). */
  tone?: "elevated" | "soft";
  children: ReactNode;
}) {
  const space = getSpaceById(spaceId);
  const Icon = space?.icon;
  const color = space?.color ?? "#0B5CFF";
  const target = href ?? space?.href ?? "/";
  const ctaTarget = ctaHref ?? target;

  return (
    <section
      className="flex flex-col rounded-[22px] transition hover:-translate-y-0.5"
      style={{
        background: tone === "soft" ? "var(--bg-card)" : "#fff",
        boxShadow: tone === "soft" ? "var(--shadow-xs)" : "var(--shadow-card)",
      }}
    >
      <header className="flex items-center gap-2 px-3 pt-4 pb-0">
        {/* Drag handle */}
        <div
          className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-slate-300 hover:text-slate-400 active:cursor-grabbing"
          aria-label="Déplacer le widget"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" strokeWidth={1.75} />
        </div>

        {/* Badge icône */}
        {Icon ? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${color}18` }}
          >
            <Icon className="h-4.5 w-4.5" style={{ color, width: 18, height: 18 }} strokeWidth={1.9} aria-hidden="true" />
          </span>
        ) : null}

        <h3 className="min-w-0 flex-1 truncate text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
          {title}
        </h3>

        <Link
          href={target}
          className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold transition hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          Voir tout
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>
      </header>

      <div className="flex flex-1 flex-col px-4 pb-0 pt-3">{children}</div>

      {ctaLabel ? (
        <div className="mt-3 px-4 py-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <Link
            href={ctaTarget}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold transition hover:opacity-75"
            style={{ color }}
          >
            {ctaLabel}
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="pb-4" />
      )}
    </section>
  );
}

export const DATE_TONE_BADGE: Record<"danger" | "warning" | "info" | "muted", { bg: string; color: string }> = {
  danger: { bg: "#FEE2E2", color: "#B91C1C" },
  warning: { bg: "#FEF3C7", color: "#B45309" },
  info: { bg: "#DBEAFE", color: "#1D4ED8" },
  muted: { bg: "#F1F5F9", color: "#475569" },
};
