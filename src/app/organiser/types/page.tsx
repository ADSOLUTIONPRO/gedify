import type { Metadata } from "next";
import { TaxonomyManager } from "@/components/forms/taxonomy-manager";
import { ErrorState } from "@/components/ui/error-state";
import { SpaceLayout } from "@/components/layout/space-layout";
import { getDocumentTypes, getPaperlessPublicUrl } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Types — Organiser" };

const TYPE_SUGGESTIONS = [
  "Facture",
  "Contrat",
  "Courrier administratif",
  "Avis d'imposition",
  "Bulletin de salaire",
  "Attestation",
  "Devis",
  "Relevé bancaire",
];

export default async function OrganiserTypesPage() {
  try {
    const data = await getDocumentTypes();
    const paperlessUrl = getPaperlessPublicUrl();
    return (
      <SpaceLayout spaceId="documents">
        <TaxonomyManager
          items={data.results ?? []}
          apiBase="/api/paperless/document-types"
          detailBase="/types"
          paperlessOriginalBase={paperlessUrl ? `${paperlessUrl}/document-types` : undefined}
          documentParam="document_type"
          noun="type"
          nounPlural="types"
          inputPlaceholder="Nom du type (ex. Facture)"
          suggestions={TYPE_SUGGESTIONS}
        />
      </SpaceLayout>
    );
  } catch (error) {
    return (
      <SpaceLayout spaceId="documents">
        <ErrorState message={error instanceof Error ? error.message : "Erreur pendant le chargement des types."} />
      </SpaceLayout>
    );
  }
}
