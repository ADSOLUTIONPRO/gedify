import type { Metadata } from "next";
import { CopyCheck } from "lucide-react";
import { SpaceLayout } from "@/components/layout/space-layout";
import { SectionCard } from "@/components/ui/section-card";
import { DuplicatesPanel } from "@/components/admin/duplicates-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Doublons — Documents" };

/**
 * Détection et fusion des doublons — fonction documentaire, intégrée à l'espace
 * Documents (layout Documents). L'ancienne route /administration/doublons
 * redirige ici. Implémentation unique (réutilise DuplicatesPanel).
 */
export default function DocumentsDoublonsPage() {
  return (
    <SpaceLayout spaceId="documents">
      <div className="space-y-4">
        <div>
          <h1 className="text-[18px] font-extrabold" style={{ color: "var(--text-main)" }}>Doublons</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
            Détectez les documents en double, comparez-les et fusionnez-les sans perdre d&apos;information.
          </p>
        </div>
        <SectionCard
          icon={CopyCheck}
          title="Groupes de doublons"
          description="La fusion conserve le document choisi et envoie les autres à la corbeille (récupérables)."
        >
          <DuplicatesPanel />
        </SectionCard>
      </div>
    </SpaceLayout>
  );
}
