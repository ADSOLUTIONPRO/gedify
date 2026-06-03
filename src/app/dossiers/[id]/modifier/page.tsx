import Link from "next/link";
import { ExternalLink, FileText, Plus } from "lucide-react";
import { ProjectDocumentPicker } from "@/components/projects/project-document-picker";
import { ProjectForm } from "@/components/projects/project-form";
import { ProjectLinkedDocuments } from "@/components/projects/project-linked-documents";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  getCorrespondents,
  getDocument,
  getDocumentTypes,
  getPaperlessPublicUrl,
  getTags,
} from "@/lib/paperless";
import type { PaperlessDocument } from "@/lib/paperless-types";
import { getProjectFolder } from "@/lib/projects/project-store";

export const dynamic = "force-dynamic";

type ModifierDossierPageProps = {
  params: Promise<{ id: string }>;
};

function fulfilledDocuments(results: PromiseSettledResult<PaperlessDocument>[]) {
  return results
    .filter((result): result is PromiseFulfilledResult<PaperlessDocument> => result.status === "fulfilled")
    .map((result) => result.value);
}

export default async function ModifierDossierPage({ params }: ModifierDossierPageProps) {
  const { id } = await params;

  try {
    const project = await getProjectFolder(id);

    if (!project) {
      return (
        <main className="p-4 lg:p-8">
          <PageHeader
            eyebrow="Classement"
            title="Dossier introuvable"
            backLink={{ href: "/dossiers", label: "Retour aux dossiers" }}
          />
          <ErrorState
            title="Dossier/projet introuvable"
            message="Impossible de modifier ce dossier, car il n'existe pas dans la couche Gedify."
          />
        </main>
      );
    }

    const [correspondentsData, tagsData, typesData, documentResults] = await Promise.all([
      getCorrespondents({ page_size: 1000 }),
      getTags({ page_size: 1000 }),
      getDocumentTypes({ page_size: 1000 }),
      Promise.allSettled(project.linkedDocumentIds.map((documentId) => getDocument(documentId))),
    ]);

    const correspondents = correspondentsData.results ?? [];
    const tags = tagsData.results ?? [];
    const types = typesData.results ?? [];
    const linkedDocuments = fulfilledDocuments(documentResults);
    const paperlessUrl = getPaperlessPublicUrl();

    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Classement"
          title={`Modifier ${project.name}`}
          description="Mettez à jour les informations du dossier, ses liens Gedify et les documents regroupés."
          backLink={{ href: `/dossiers/${project.id}`, label: "Retour au dossier" }}
          actions={
            paperlessUrl ? (
              <Link
                href={paperlessUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Ouvrir Gedify
              </Link>
            ) : null
          }
        />

        <div className="space-y-6">
          <ProjectForm
            mode="edit"
            project={project}
            correspondents={correspondents}
            tags={tags}
            types={types}
          />

          <SectionCard
            icon={Plus}
            title="Ajouter des documents"
            description="Rechercher dans la GED, filtrer et sélectionner plusieurs documents à lier au dossier."
          >
            <ProjectDocumentPicker
              projectId={project.id}
              linkedDocumentIds={project.linkedDocumentIds}
              correspondents={correspondents}
              types={types}
              tags={tags}
            />
          </SectionCard>

          <SectionCard
            icon={FileText}
            title="Documents déjà liés"
            description="Retirer un document du dossier ne supprime rien dans la GED."
          >
            <ProjectLinkedDocuments
              projectId={project.id}
              documents={linkedDocuments}
              correspondents={correspondents}
              types={types}
              tags={tags}
              editable
            />
          </SectionCard>
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Classement"
          title="Modifier un dossier / projet"
          backLink={{ href: "/dossiers", label: "Retour aux dossiers" }}
        />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
      </main>
    );
  }
}
