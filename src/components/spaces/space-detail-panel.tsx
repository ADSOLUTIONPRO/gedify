"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Space, SpaceStat } from "@/config/spaces";

type SpaceDetailPanelProps = {
  space: Space;
  /** Stats réelles côté serveur (écrasent space.stats si fournies). */
  liveStats?: SpaceStat[];
};

/**
 * Panneau « Espace sélectionné » de la page d'accueil : description, actions
 * rapides et statistiques de l'espace mis en avant sur la carte radiale.
 */
export function SpaceDetailPanel({ space, liveStats }: SpaceDetailPanelProps) {
  const stats = liveStats ?? space.stats;
  const Icon = space.icon;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
        Espace sélectionné
      </p>

      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `${space.color}14`, color: space.color }}
        >
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
            {space.label}
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug" style={{ color: "var(--text-muted)" }}>
            {space.description}
          </p>
        </div>
      </div>

      <Link
        href={space.href}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: space.color }}
      >
        Ouvrir l&apos;espace
        <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </Link>

      {space.quickActions && space.quickActions.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Actions rapides
          </p>
          <div className="space-y-1">
            {space.quickActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition hover:bg-slate-50"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                >
                  <ActionIcon className="h-4 w-4 shrink-0" style={{ color: space.color }} strokeWidth={1.75} aria-hidden="true" />
                  <span className="flex-1 truncate">{action.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" strokeWidth={2} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {stats && stats.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Aperçu
          </p>
          <div className="grid grid-cols-2 gap-2">
            {stats!.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border px-3 py-2.5"
                style={{ borderColor: "var(--border)" }}
              >
                <p className="text-lg font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
                  {stat.value}
                </p>
                <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
