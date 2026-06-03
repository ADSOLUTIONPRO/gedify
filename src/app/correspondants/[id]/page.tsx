import Link from "next/link";
import { DocumentCard } from "@/components/documents/document-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  getCorrespondents,
  getDocumentTypes,
  getDocuments,
  getPaperlessPublicUrl,
  getTags,
  paperlessFetch,
} from "@/lib/paperless";
import type { PaperlessCorrespondent } from "@/lib/paperless-types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CorrespondantDetailPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const [correspondent, documentsData, correspondentsData, typesData, tagsData] =
      await Promise.all([
        paperlessFetch<PaperlessCorrespondent>(`/api/correspondents/${id}/`),
        getDocuments({ page_size: 12, correspondent__id: id, ordering: "-added" }),
        getCorrespondents(),
        getDocumentTypes(),
        getTags(),
      ]);

    const documents = documentsData.results ?? [];

    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Correspondant"
          title={correspondent.name}
          description="Documents et informations associés à ce correspondant Gedify."
          actions={
            <Link
              href={`/documents?correspondent=${correspondent.id}`}
              className="inline-flex h-11 items-center rounded-lg bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800"
            >
              Voir tous les documents
            </Link>
          }
        />

        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <StatCard label="ID document" value={`#${correspondent.id}`} helper="Référence API" />
          <StatCard
            label="Documents"
            value={correspondent.document_count ?? documentsData.count}
            helper="Documents associés"
            tone="blue"
          />
          <StatCard
            label="Modification"
            value={correspondent.user_can_change === false ? "Limitée" : "Possible"}
            helper="Selon les permissions Gedify"
            tone="emerald"
          />
        </section>

        {documents.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white">
            <EmptyState
              title="Aucun document lié"
              description="Aucun document récent ne correspond à ce correspondant."
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                correspondents={correspondentsData.results ?? []}
                types={typesData.results ?? []}
                tags={tagsData.results ?? []}
                paperlessUrl={getPaperlessPublicUrl()}
              />
            ))}
          </div>
        )}
      </main>
    );
  } catch (error) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader eyebrow="Correspondant" title="Correspondant introuvable" />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
      </main>
    );
  }
}
