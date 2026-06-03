"use client";

import { useState } from "react";
import { spaces, type Space, type SpaceStat } from "@/config/spaces";
import { BrandLogo } from "@/components/ui/brand-logo";
import { SpaceCard } from "@/components/spaces/space-card";
import { SpaceDetailPanel } from "@/components/spaces/space-detail-panel";

type Props = {
  /** Stats réelles injectées côté serveur, indexées par spaceId. */
  liveStats?: Record<string, SpaceStat[]>;
};

/**
 * Vue d'ensemble des espaces (page d'accueil).
 *
 * - Grand écran : carte radiale — logo central « GED AzServer » entouré des
 *   espaces, reliés par des traits pointillés. Sélectionner un nœud met à jour
 *   le panneau détail à droite.
 * - Tablette / mobile : repli en grille de cartes + panneau détail dessous.
 */
export function SpaceOverviewMap({ liveStats }: Props) {
  const [selectedId, setSelectedId] = useState<string>(spaces[0]?.id ?? "");
  const selected = spaces.find((space) => space.id === selectedId) ?? spaces[0];

  // Positions radiales (en %) — premier nœud en haut, sens horaire.
  const n = spaces.length;
  const radius = 41;
  const nodes = spaces.map((space, index) => {
    const angle = (-90 + (360 / n) * index) * (Math.PI / 180);
    return {
      space,
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    };
  });

  function handleSelect(space: Space) {
    setSelectedId(space.id);
  }

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      {/* Zone carte / grille */}
      <div className="min-w-0 flex-1">
        {/* Carte radiale (lg+) */}
        <div className="relative mx-auto hidden aspect-square w-full max-w-[640px] lg:block">
          {/* Connecteurs */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {nodes.map(({ space, x, y }) => (
              <line
                key={space.id}
                x1="50"
                y1="50"
                x2={x}
                y2={y}
                stroke={space.id === selectedId ? space.color : "#C9D6EA"}
                strokeWidth={space.id === selectedId ? 0.5 : 0.3}
                strokeDasharray="1.4 1.4"
                opacity={space.id === selectedId ? 0.9 : 0.6}
              />
            ))}
          </svg>

          {/* Logo central */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-xl" style={{ border: "1px solid var(--border)" }}>
              <BrandLogo variant="icon" className="h-12 w-auto" />
            </div>
          </div>

          {/* Nœuds */}
          {nodes.map(({ space, x, y }) => (
            <div
              key={space.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <SpaceCard
                space={space}
                variant="node"
                selected={space.id === selectedId}
                onSelect={handleSelect}
              />
            </div>
          ))}
        </div>

        {/* Grille (< lg) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:hidden">
          {spaces.map((space) => (
            <SpaceCard
              key={space.id}
              space={space}
              variant="tile"
              selected={space.id === selectedId}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {/* Panneau détail */}
      <aside className="w-full xl:w-[320px] xl:shrink-0">
        <div
          className="rounded-2xl border bg-white p-5 xl:sticky xl:top-[88px]"
          style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}
        >
          <SpaceDetailPanel space={selected} liveStats={liveStats?.[selected?.id ?? ""]} />
        </div>
      </aside>
    </div>
  );
}
