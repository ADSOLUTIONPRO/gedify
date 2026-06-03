"use client";

import Link from "next/link";
import type { Space } from "@/config/spaces";

type SpaceCardProps = {
  space: Space;
  /** "tile" = carte pleine (grille) ; "node" = pastille compacte (carte radiale). */
  variant?: "tile" | "node";
  selected?: boolean;
  onSelect?: (space: Space) => void;
};

/**
 * Carte d'espace. Deux usages :
 * - `tile` : carte blanche cliquable, repli en grille sur petit écran ;
 * - `node` : pastille compacte positionnée sur la carte radiale.
 */
export function SpaceCard({ space, variant = "tile", selected = false, onSelect }: SpaceCardProps) {
  const Icon = space.icon;

  if (variant === "node") {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(space)}
        aria-pressed={selected}
        className="group flex w-[112px] flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-center transition hover:bg-white"
        style={selected ? { background: "#fff", boxShadow: "0 4px 18px rgba(8,18,37,0.10)" } : undefined}
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-white transition group-hover:scale-105"
          style={{
            borderColor: selected ? space.color : "var(--border)",
            color: space.color,
            boxShadow: selected ? `0 0 0 3px ${space.color}22` : "0 1px 2px rgba(8,18,37,0.05)",
          }}
        >
          <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
        </span>
        <span
          className="text-[12px] font-semibold leading-tight"
          style={{ color: selected ? space.color : "var(--text-main)" }}
        >
          {space.label}
        </span>
      </button>
    );
  }

  return (
    <Link
      href={space.href}
      onClick={() => onSelect?.(space)}
      className="group flex flex-col rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5"
      style={{
        borderColor: selected ? space.color : "var(--border)",
        boxShadow: selected ? `0 8px 24px ${space.color}1f` : "0 1px 2px rgba(8,18,37,0.04)",
      }}
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-2xl"
        style={{ background: `${space.color}14`, color: space.color }}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
      </span>
      <span className="mt-3 text-[15px] font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
        {space.label}
      </span>
      <span className="mt-0.5 text-[12.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
        {space.shortDescription}
      </span>
    </Link>
  );
}
