import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { CompactSpaceHeader } from "@/components/layout/compact-space-header";
import { ResponsiveDetailPanel } from "@/components/layout/responsive-detail-panel";
import { SpaceSidebar } from "@/components/layout/space-sidebar";
import { getSpaceById } from "@/config/spaces";
import { getSpaceNav } from "@/config/space-navigation";

type SpaceLayoutProps = {
  spaceId: string;
  children: ReactNode;
  /** Contenu du panneau de détail à droite (optionnel). */
  detail?: ReactNode;
  /** Titre du panneau de détail. */
  detailTitle?: string;
  /** Slot d'actions dans l'en-tête. */
  actions?: ReactNode;
};

/**
 * Layout commun des pages internes d'un espace : en-tête compact + contenu +
 * panneau détail responsive.
 *
 * - Navigation interne de l'espace : assurée par la sidebar d'espace globale
 *   (`SpaceMenuSidebar`, Zone 2) dès `lg`. En dessous, les onglets horizontaux
 *   ci-dessous prennent le relais (la sidebar n'y est qu'un drawer à la demande).
 * - Panneau détail : colonne à droite ≥ xl, drawer en dessous.
 */
export function SpaceLayout({ spaceId, children, detail, detailTitle, actions }: SpaceLayoutProps) {
  const space = getSpaceById(spaceId);
  if (!space) notFound();
  const nav = getSpaceNav(spaceId);

  return (
    <div className="px-4 py-5 lg:px-6 lg:py-6">
      <CompactSpaceHeader space={space} actions={actions} />

      {/* Onglets internes : uniquement < md (la sidebar d'espace les remplace dès md) */}
      {nav.length > 0 ? (
        <div className="mt-4 md:hidden">
          {/* useSearchParams (SpaceSidebar) requiert une frontière Suspense. */}
          <Suspense fallback={<div className="h-10 border-b" style={{ borderColor: "var(--border)" }} />}>
            <SpaceSidebar items={nav} color={space.color} />
          </Suspense>
        </div>
      ) : null}

      <div className="mt-5 flex gap-6">
        <div className="min-w-0 flex-1">{children}</div>
        {detail ? (
          <ResponsiveDetailPanel title={detailTitle ?? "Détail"}>{detail}</ResponsiveDetailPanel>
        ) : null}
      </div>
    </div>
  );
}
