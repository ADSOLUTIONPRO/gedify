import type { Metadata } from "next";
import { TaxonomyManager } from "@/components/forms/taxonomy-manager";
import { ErrorState } from "@/components/ui/error-state";
import { SpaceLayout } from "@/components/layout/space-layout";
import { getPaperlessPublicUrl, getTags } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tags — Organiser" };

const TAG_SUGGESTIONS = ["Important", "À traiter", "Banque", "Santé", "Logement", "Impôts", "Assurance", "Famille"];

export default async function OrganiserTagsPage() {
  try {
    const data = await getTags();
    const paperlessUrl = getPaperlessPublicUrl();
    return (
      <SpaceLayout spaceId="documents">
        <TaxonomyManager
          items={data.results ?? []}
          apiBase="/api/paperless/tags"
          detailBase="/tags"
          paperlessOriginalBase={paperlessUrl ? `${paperlessUrl}/tags` : undefined}
          documentParam="tag"
          noun="tag"
          nounPlural="tags"
          inputPlaceholder="Nom du tag (ex. Important)"
          suggestions={TAG_SUGGESTIONS}
          colorEnabled
        />
      </SpaceLayout>
    );
  } catch (error) {
    return (
      <SpaceLayout spaceId="documents">
        <ErrorState message={error instanceof Error ? error.message : "Erreur pendant le chargement des tags."} />
      </SpaceLayout>
    );
  }
}
