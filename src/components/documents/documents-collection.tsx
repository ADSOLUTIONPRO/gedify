import { Suspense } from "react";
import { LayoutGrid, Rows3, Table2 } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { MobileDocuments } from "@/components/mobile/mobile-documents";
import { Pagination } from "@/components/ui/pagination";
import { ViewToggle } from "@/components/ui/view-toggle";
import { SpaceLayout } from "@/components/layout/space-layout";
import { DocumentSpace } from "@/components/documents/document-space";
import { DocumentFilters } from "@/components/documents/document-filters";
import { PageSizeSelector } from "@/components/documents/page-size-selector";
import { SaveViewButton } from "@/components/documents/save-view-button";
import type { DocumentFilterValues } from "@/components/documents/document-filters";
import { buildDocumentApiParams, buildDocumentVMs, matchesEtat } from "@/lib/documents/document-list-loader";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { isDocumentToProcess } from "@/lib/document-utils";
import { listArchivedIds } from "@/lib/documents/archived-store";
import { cleanSearchParams, firstParam, numberParam, type PageSearchParams } from "@/lib/page-params";
import {
  getCorrespondents,
  getDocumentTypes,
  getDocuments,
  getPaperlessPublicUrl,
  getTags,
} from "@/lib/paperless";
import type { PaperlessDocument } from "@/lib/paperless-types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listFavoriteIds } from "@/lib/documents/favorites-store";

export type DocumentsScope = "default" | "a-traiter" | "archives";

const PAGE_SIZES = [24, 48, 96, 200];
const DEFAULT_PAGE_SIZE = 24;
const UNSUPPORTED_TABS = new Set(["partages"]);

function emptyMessage(tab: string): { title: string; description: string; showImport: boolean } {
  switch (tab) {
    case "favoris":
      return { title: "Aucun document favori", description: "Cliquez sur l'étoile d'un document pour le retrouver ici.", showImport: false };
    case "recents":
      return { title: "Aucun document récent", description: "Les documents importés au cours des dernières 48 heures apparaîtront ici.", showImport: false };
    case "partages":
      return { title: "Aucun partage", description: "Le partage de documents arrivera prochainement.", showImport: false };
    case "a-traiter":
      return { title: "Aucun document à traiter", description: "Tous vos documents sont actuellement classés et vérifiés.", showImport: false };
    case "archives":
      return { title: "Aucun document archivé", description: "Les documents archivés apparaîtront ici.", showImport: false };
    default:
      return { title: "Aucun document trouvé", description: "Ajustez les filtres ou importez un document.", showImport: true };
  }
}

type CollectionData = {
  documents: Awaited<ReturnType<typeof buildDocumentVMs>>;
  visibleDocs: Awaited<ReturnType<typeof buildDocumentVMs>>;
  totalCount: number;
  count: number;
  correspondents: { id: number; name: string }[];
  types: { id: number; name: string }[];
  tags: { id: number; name: string }[];
  paperlessUrl: string | null;
  filterValues: DocumentFilterValues;
  hidden: Record<string, string>;
  resetHref: string;
  paginationParams: Record<string, string | undefined>;
  message: { title: string; description: string; showImport: boolean };
  postFiltered: boolean;
  selectAllQuery: string;
  currentQuery: string;
  etat: string | undefined;
  view: "grid" | "table" | "thumbnail";
  page: number;
  pageSize: number;
  tab: string;
};

/** Charge les données de la collection (aucun JSX). Peut lever (erreur réseau). */
async function loadCollection(params: Awaited<PageSearchParams>, scope: DocumentsScope): Promise<CollectionData> {
  const page = numberParam(params, "page", 1);
  const viewParam = firstParam(params, "view", "");
  const view: CollectionData["view"] = viewParam === "table" ? "table" : viewParam === "thumbnail" ? "thumbnail" : "grid";
  const tab = scope === "a-traiter" ? "a-traiter" : scope === "archives" ? "archives" : (firstParam(params, "tab", "") ?? "");
  const reqSize = numberParam(params, "taille", DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZES.includes(reqSize) ? reqSize : DEFAULT_PAGE_SIZE;

  const currentQueryObj: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (typeof val === "string" && val) currentQueryObj[k] = val;
  }
  const currentQuery = new URLSearchParams(currentQueryObj).toString();
  const selectAllObj: Record<string, string> = {};
  for (const k of ["query", "correspondent", "document_type", "tag", "created_from", "added_from", "asn", "ordering"]) {
    const val = firstParam(params, k);
    if (val) selectAllObj[k] = val;
  }
  if (tab) selectAllObj.tab = tab;
  const selectAllQuery = new URLSearchParams(selectAllObj).toString();

  let unsupported = UNSUPPORTED_TABS.has(tab);
  const apiParams = buildDocumentApiParams(params, tab, pageSize);

  const archivedIds = scope === "archives" || scope === "default" ? await listArchivedIds() : [];
  const archivedSet = new Set(archivedIds);
  if (scope === "archives") {
    if (archivedIds.length === 0) unsupported = true;
    else apiParams.id__in = archivedIds.join(",");
  }
  if (tab === "favoris") {
    const user = await getCurrentUser();
    const favoriteIds = await listFavoriteIds(user ? String(user.id) : "local");
    if (favoriteIds.length === 0) unsupported = true;
    else apiParams.id__in = favoriteIds.join(",");
  }

  const [documentsData, correspondentsData, typesData, tagsData] = await Promise.all([
    unsupported ? Promise.resolve({ count: 0, results: [] as PaperlessDocument[] }) : getDocuments(apiParams),
    getCorrespondents(),
    getDocumentTypes(),
    getTags(),
  ]);

  const correspondents = correspondentsData.results ?? [];
  const types = typesData.results ?? [];
  const tags = tagsData.results ?? [];
  const paperlessUrl = getPaperlessPublicUrl();
  const rawDocuments = documentsData.results ?? [];

  const pageDocIds = rawDocuments.map((d) => Number(d.id));
  let analyses: Awaited<ReturnType<typeof listAnalyses>> = [];
  let financialItems: Awaited<ReturnType<typeof listFinancialItems>> = [];
  if (!unsupported && pageDocIds.length > 0) {
    [analyses, financialItems] = await Promise.all([
      listAnalyses({ documentIds: pageDocIds }),
      listFinancialItems({ documentIds: pageDocIds }),
    ]);
  }

  const filtered =
    scope === "a-traiter"
      ? rawDocuments.filter((d) => isDocumentToProcess(d, tags))
      : scope === "archives"
        ? rawDocuments
        : rawDocuments.filter((d) => !archivedSet.has(Number(d.id)));

  const documents = await buildDocumentVMs(filtered, { correspondents, types, tags, analyses, financialItems, paperlessUrl });

  const etat = firstParam(params, "etat");
  const visibleDocs = etat ? documents.filter((d) => matchesEtat(d.statuses, etat)) : documents;

  const filterValues: DocumentFilterValues = {
    query: firstParam(params, "query"),
    correspondent: firstParam(params, "correspondent"),
    document_type: firstParam(params, "document_type"),
    tag: firstParam(params, "tag"),
    created_from: firstParam(params, "created_from"),
    added_from: firstParam(params, "added_from"),
    asn: firstParam(params, "asn"),
    ordering: firstParam(params, "ordering"),
    etat,
  };

  const hidden: Record<string, string> = { view };
  if (scope === "default" && tab) hidden.tab = tab;
  const paginationParams = cleanSearchParams(params, [
    "tab", "query", "correspondent", "document_type", "tag",
    "created_from", "added_from", "asn", "ordering", "etat", "view", "taille",
  ]);

  // « Archives » : pagination exacte (id__in). « À traiter » / « Tous » : filtre
  // post-fetch de la page courante → on masque la pagination si filtre actif.
  const postFiltered = scope === "a-traiter" || (scope === "default" && filtered.length !== rawDocuments.length);

  return {
    documents, visibleDocs,
    totalCount: etat || postFiltered ? visibleDocs.length : documentsData.count,
    count: documentsData.count,
    correspondents: correspondents.map((c) => ({ id: c.id, name: c.name })),
    types: types.map((t) => ({ id: t.id, name: t.name })),
    tags: tags.map((t) => ({ id: t.id, name: t.name })),
    paperlessUrl,
    filterValues, hidden,
    resetHref: "",
    paginationParams,
    message: emptyMessage(tab),
    postFiltered, selectAllQuery, currentQuery,
    etat, view, page, pageSize, tab,
  };
}

/**
 * Collection de documents partagée par « Tous les documents », « À traiter » et
 * « Archives » : même interface (grille/liste, sélection, filtres, actions),
 * seul le périmètre (`scope`) change.
 */
export async function DocumentsCollection({
  params,
  basePath,
  scope = "default",
}: {
  params: Awaited<PageSearchParams>;
  basePath: string;
  scope?: DocumentsScope;
}) {
  let data: CollectionData | null = null;
  let errorMsg: string | null = null;
  try {
    data = await loadCollection(params, scope);
  } catch (error) {
    errorMsg = error instanceof Error ? error.message : "Erreur inconnue pendant le chargement.";
  }

  if (errorMsg || !data) {
    return (
      <SpaceLayout spaceId="documents">
        <ErrorState message={errorMsg ?? "Erreur inconnue pendant le chargement."} />
      </SpaceLayout>
    );
  }

  const resetHref = `${basePath}?${new URLSearchParams(data.hidden).toString()}`;
  const footer =
    data.visibleDocs.length > 0 && !data.etat && !data.postFiltered ? (
      <Pagination count={data.count} page={data.page} pageSize={data.pageSize} basePath={basePath} searchParams={data.paginationParams} />
    ) : null;

  return (
    <>
      <Suspense fallback={null}>
        <MobileDocuments docs={data.visibleDocs} tab={data.tab} filterValues={data.filterValues} correspondents={data.correspondents} types={data.types} />
      </Suspense>

      <div className="hidden md:block">
        <SpaceLayout
          spaceId="documents"
          actions={
            <>
              <SaveViewButton />
              <PageSizeSelector value={data.pageSize} currentQuery={data.currentQuery} />
              <ViewToggle
                options={[
                  { value: "grid", icon: LayoutGrid, label: "Grille" },
                  { value: "thumbnail", icon: Rows3, label: "Vignette" },
                  { value: "table", icon: Table2, label: "Liste" },
                ]}
                active={data.view}
                hrefBuilder={(v) => {
                  const usp = new URLSearchParams(data!.hidden);
                  usp.set("view", v);
                  return `${basePath}?${usp.toString()}`;
                }}
              />
              <DocumentFilters
                values={data.filterValues}
                correspondents={data.correspondents}
                types={data.types}
                tags={data.tags}
                hidden={data.hidden}
                resetHref={resetHref}
                basePath={basePath}
              />
            </>
          }
        >
          <DocumentSpace
            docs={data.visibleDocs}
            totalCount={data.totalCount}
            selectAllQuery={data.etat || data.postFiltered ? undefined : data.selectAllQuery}
            view={data.view}
            correspondents={data.correspondents}
            types={data.types}
            tags={data.tags}
            footer={footer}
            emptyTitle={data.message.title}
            emptyDescription={data.message.description}
            showImport={data.message.showImport}
            paperlessUrl={data.paperlessUrl}
            archiveMode={scope === "archives" ? "unarchive" : "archive"}
          />
        </SpaceLayout>
      </div>
    </>
  );
}
