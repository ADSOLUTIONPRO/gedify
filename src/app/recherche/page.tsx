import Link from "next/link";
import { ArrowRight, FolderKanban, Search } from "lucide-react";
import { DocumentCard } from "@/components/documents/document-card";
import { ProjectCard } from "@/components/projects/project-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { SectionCard } from "@/components/ui/section-card";
import { cleanSearchParams, firstParam, numberParam, type PageSearchParams } from "@/lib/page-params";
import {
  getCorrespondents,
  getDocumentTypes,
  getDocuments,
  getPaperlessPublicUrl,
  getTags,
} from "@/lib/paperless";
import { listProjectFolders } from "@/lib/projects/project-store";
import { projectMatchesQuery } from "@/lib/projects/project-utils";

export const dynamic = "force-dynamic";

const pageSize = 18;

function labelClass() {
  return "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
}

function fieldClass() {
  return "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
}

function buildSearchApiParams(params: Record<string, string | string[] | undefined>) {
  const apiParams: Record<string, string | number> = {
    page: numberParam(params, "page", 1),
    page_size: pageSize,
    ordering: firstParam(params, "ordering", "-added"),
  };
  const query = firstParam(params, "query");
  const correspondent = firstParam(params, "correspondent");
  const documentType = firstParam(params, "document_type");
  const tag = firstParam(params, "tag");

  if (query) apiParams.query = query;
  if (correspondent) apiParams.correspondent__id = correspondent;
  if (documentType) apiParams.document_type__id = documentType;
  if (tag) apiParams.tags__id__all = tag;

  return apiParams;
}

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const page = numberParam(params, "page", 1);
  const includeProjects = firstParam(params, "include_projects") === "on";

  try {
    const [documentsData, correspondentsData, typesData, tagsData, projects] = await Promise.all([
      getDocuments(buildSearchApiParams(params)),
      getCorrespondents(),
      getDocumentTypes(),
      getTags(),
      listProjectFolders(),
    ]);

    const correspondents = correspondentsData.results ?? [];
    const types = typesData.results ?? [];
    const tags = tagsData.results ?? [];
    const paperlessUrl = getPaperlessPublicUrl();
    const paginationParams = cleanSearchParams(params, [
      "query",
      "correspondent",
      "document_type",
      "tag",
      "ordering",
      "include_projects",
    ]);
    const query = firstParam(params, "query");
    const matchingProjects = includeProjects
      ? projects.filter((project) => projectMatchesQuery(project, query)).slice(0, 6)
      : [];

    return (
      <main className="p-4 lg:p-8">
        <PageHeader
          eyebrow="Recherche avancée"
          title="Recherche"
          description="Recherche plein texte Gedify avec filtres de classement, tri et résultats détaillés."
          actions={
            <Link
              href="/vues"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
            >
              <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Vues sauvegardées
            </Link>
          }
        />

        <form action="/recherche" className="mb-6">
          <FilterBar resetHref="/recherche">
            <SearchInput
              defaultValue={firstParam(params, "query")}
              placeholder="Rechercher dans le titre et le contenu OCR"
              label="Texte"
            />
            <label>
              <span className={labelClass()}>Correspondant</span>
              <select
                name="correspondent"
                defaultValue={firstParam(params, "correspondent")}
                className={fieldClass()}
              >
                <option value="">Tous</option>
                {correspondents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass()}>Type</span>
              <select
                name="document_type"
                defaultValue={firstParam(params, "document_type")}
                className={fieldClass()}
              >
                <option value="">Tous</option>
                {types.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass()}>Tag</span>
              <select name="tag" defaultValue={firstParam(params, "tag")} className={fieldClass()}>
                <option value="">Tous</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass()}>Tri</span>
              <select
                name="ordering"
                defaultValue={firstParam(params, "ordering", "-added")}
                className={fieldClass()}
              >
                <option value="-added">Plus récent</option>
                <option value="added">Plus ancien</option>
                <option value="title">Titre A-Z</option>
                <option value="-created">Date document récente</option>
                <option value="created">Date document ancienne</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                name="include_projects"
                value="on"
                defaultChecked={includeProjects}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Dossiers / Projets
            </label>
          </FilterBar>
        </form>

        {includeProjects ? (
          <SectionCard
            icon={FolderKanban}
            title="Dossiers / Projets trouvés"
            description={
              query
                ? `${matchingProjects.length} dossier(s) correspondant à la recherche.`
                : "La recherche globale peut aussi inclure la couche Dossiers / Projets."
            }
            className="mb-6"
            bodyClassName={matchingProjects.length > 0 ? "p-5" : "p-0"}
          >
            {matchingProjects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title={query ? "Aucun dossier trouvé" : "Recherche projets prête"}
                description={
                  query
                    ? "Aucun dossier/projet Gedify ne correspond à cette recherche."
                    : "Saisissez un texte pour retrouver aussi vos dossiers et projets."
                }
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {matchingProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    correspondents={correspondents}
                    tags={tags}
                    types={types}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        ) : null}

        <SectionCard
          title="Résultats"
          description={`${documentsData.count} document(s) trouvé(s)`}
          actions={
            <Link
              href="/documents"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
            >
              Liste complète
              <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </Link>
          }
          bodyClassName=""
        >
          {documentsData.results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Aucun résultat"
              description="Ajuste la recherche ou les filtres."
            />
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-2">
              {documentsData.results.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  correspondents={correspondents}
                  types={types}
                  tags={tags}
                  paperlessUrl={paperlessUrl}
                />
              ))}
            </div>
          )}

          <Pagination
            count={documentsData.count}
            page={page}
            pageSize={pageSize}
            basePath="/recherche"
            searchParams={paginationParams}
          />
        </SectionCard>
      </main>
    );
  } catch (error) {
    return (
      <main className="p-4 lg:p-8">
        <PageHeader eyebrow="Recherche avancée" title="Recherche" />
        <ErrorState
          message={error instanceof Error ? error.message : "Erreur inconnue pendant la recherche."}
        />
      </main>
    );
  }
}
