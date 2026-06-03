import type { Metadata } from "next";
import { TaxonomyManager } from "@/components/forms/taxonomy-manager";
import { ErrorState } from "@/components/ui/error-state";
import { SpaceLayout } from "@/components/layout/space-layout";
import { getCorrespondents, getPaperlessPublicUrl } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Correspondants — Organiser" };

const CORRESPONDENT_SUGGESTIONS = ["EDF", "CAF", "Trésor Public", "Ameli", "Pôle Emploi", "Banque", "Mutuelle", "URSSAF"];

export default async function OrganiserCorrespondantsPage() {
  try {
    const data = await getCorrespondents();
    const paperlessUrl = getPaperlessPublicUrl();
    return (
      <SpaceLayout spaceId="organiser">
        <TaxonomyManager
          items={data.results ?? []}
          apiBase="/api/paperless/correspondents"
          detailBase="/correspondants"
          paperlessOriginalBase={paperlessUrl ? `${paperlessUrl}/correspondents` : undefined}
          documentParam="correspondent"
          noun="correspondant"
          nounPlural="correspondants"
          inputPlaceholder="Nom du correspondant (ex. EDF)"
          suggestions={CORRESPONDENT_SUGGESTIONS}
        />
      </SpaceLayout>
    );
  } catch (error) {
    return (
      <SpaceLayout spaceId="organiser">
        <ErrorState message={error instanceof Error ? error.message : "Erreur pendant le chargement des correspondants."} />
      </SpaceLayout>
    );
  }
}
