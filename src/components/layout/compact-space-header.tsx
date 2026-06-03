import type { ReactNode } from "react";
import type { Space } from "@/config/spaces";

type CompactSpaceHeaderProps = {
  space: Space;
  /** Slot d'actions à droite (boutons, filtres…). */
  actions?: ReactNode;
};

/**
 * En-tête compact d'un espace : icône colorée + titre + description, avec un
 * slot d'actions à droite. Couleur de domaine appliquée à l'icône.
 */
export function CompactSpaceHeader({ space, actions }: CompactSpaceHeaderProps) {
  const Icon = space.icon;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `${space.color}14`, color: space.color }}
        >
          <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h1
            className="text-[24px] font-extrabold leading-tight tracking-tight sm:text-[26px]"
            style={{ color: "var(--gedify-navy)" }}
          >
            {space.label}
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            {space.description}
          </p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
