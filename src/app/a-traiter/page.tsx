import { TreatmentWorkbench } from "@/components/forms/treatment-workbench";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { isDocumentToProcess } from "@/lib/document-utils";
import {
  getCorrespondents,
  getDocumentTypes,
  getDocuments,
  getTags,
} from "@/lib/paperless";

export const dynamic = "force-dynamic";

export default async function ATraiterPage() {
  try {
    const [documentsData, correspondentsData, typesData, tagsData] = await Promise.all([
      getDocuments({ page_size: 80, ordering: "-added" }),
      getCorrespondents(),
      getDocumentTypes(),
      getTags(),
    ]);

    const tags = tagsData.results ?? [];
    const documents = (documentsData.results ?? []).filter((document) =>
      isDocumentToProcess(document, tags)
    );

    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Classement rapide"
          title="Documents à traiter"
          description="Documents sans correspondant, sans type, sans tag ou portant un tag de traitement. Les validations mettent directement à jour Gedify."
        />

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <StatCard label="À traiter" value={documents.length} helper="Dans le lot récent chargé" />
          <StatCard
            label="Lot analysé"
            value={documentsData.results.length}
            helper="Documents récents vérifiés"
            tone="blue"
          />
          <StatCard label="Mode" value="Rapide" helper="Validation document par document" tone="emerald" />
        </section>

        {documents.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white">
            <EmptyState
              title="Aucun document à traiter"
              description="Les documents récents ont déjà les métadonnées principales."
            />
          </div>
        ) : (
          <TreatmentWorkbench
            documents={documents}
            correspondents={correspondentsData.results ?? []}
            documentTypes={typesData.results ?? []}
            tags={tags}
          />
        )}
      </main>
    );
  } catch (error) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader eyebrow="Classement rapide" title="Documents à traiter" />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
      </main>
    );
  }
}
