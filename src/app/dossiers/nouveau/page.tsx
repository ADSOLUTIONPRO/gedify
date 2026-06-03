import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ProjectForm } from "@/components/projects/project-form";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCorrespondents, getDocumentTypes, getPaperlessPublicUrl, getTags } from "@/lib/paperless";
import { getProjectFolder } from "@/lib/projects/project-store";

export const dynamic = "force-dynamic";

export default async function NouveauDossierPage({ searchParams }: { searchParams: Promise<{ parent?: string }> }) {
  try {
    const { parent } = await searchParams;
    const [correspondentsData, tagsData, typesData, parentFolder] = await Promise.all([
      getCorrespondents({ page_size: 1000 }),
      getTags({ page_size: 1000 }),
      getDocumentTypes({ page_size: 1000 }),
      parent ? getProjectFolder(parent) : Promise.resolve(null),
    ]);

    const paperlessUrl = getPaperlessPublicUrl();

    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Classement"
          title="Créer un dossier / projet"
          description="Créez une couche de classement propre à Gedify pour regrouper des documents Gedify autour d’une affaire, d’un projet ou d’un dossier en cours."
          backLink={{ href: "/dossiers", label: "Retour aux dossiers" }}
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

        <ProjectForm
          mode="create"
          correspondents={correspondentsData.results ?? []}
          tags={tagsData.results ?? []}
          types={typesData.results ?? []}
          parentId={parentFolder?.id ?? null}
          parentName={parentFolder?.name ?? null}
        />
      </main>
    );
  } catch (error) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Classement"
          title="Créer un dossier / projet"
          backLink={{ href: "/dossiers", label: "Retour aux dossiers" }}
        />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."}
        />
      </main>
    );
  }
}
