import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { WorkflowsManager } from "@/components/workflows/workflows-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Workflows — Documents" };

/**
 * Workflows — refonte (résumé compact + liste à gauche + panneau de détail à
 * droite, même logique graphique que « Emails & boîtes connectées »). Plus de
 * cartes techniques ni de « Fonction bientôt disponible ». Branché sur le vrai
 * modèle GEDify (/api/automation/workflows).
 */
export default function WorkflowsPage() {
  return (
    <SpaceLayout spaceId="documents">
      <div className="mx-auto w-full max-w-6xl">
        <WorkflowsManager />
      </div>
    </SpaceLayout>
  );
}
