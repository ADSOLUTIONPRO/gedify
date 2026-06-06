import { Suspense } from "react";
import Link from "next/link";
import { LayoutGrid, Plus, Table2 } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { MobileDocuments } from "@/components/mobile/mobile-documents";
import { Pagination } from "@/components/ui/pagination";
import { ViewToggle } from "@/components/ui/view-toggle";
import { SpaceLayout } from "@/components/layout/space-layout";
import { DocumentSpace } from "@/components/documents/document-space";
import { PageSizeSelector } from "@/components/documents/page-size-selector";
import type { DocumentFilterValues } from "@/components/documents/document-filters";
import { buildDocumentApiParams, buildDocumentVMs, matchesEtat } from "@/lib/documents/document-list-loader";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { isDocumentArchived, isDocumentToProcess } from "@/lib/document-utils";
import { cleanSearchParams, firstParam, numberParam, type PageSearchParams } from "@/lib/page-params";
import {
  getCorrespondents,
  getDocumentTypes,
  getDocuments,
  getPaperlessPublicUrl,
  getTags,
} from "@/lib/paperless";
import type { PaperlessDocument } from "@/lib/paperless-types";

export const dynamic = "force-dynamic";

/** Tailles de page proposées (sélecteur « par page »). */
const PAGE_SIZES = [24, 48, 96, 200];
const DEFAULT_PAGE_SIZE = 24;

/** Onglets non encore branchés à un back-end (affichage propre, sans 404). */
const UNSUPPORTED_TABS = new Set(["favoris", "partages"]);

function emptyMessage(tab: string): { title: string; description: string; showImport: boolean } {
  switch (tab) {
    case "favoris":
      return { title: "Aucun favori", description: "La mise en favori des documents arrivera prochainement.", showImport: false };
    case "partages":
      return { title: "Aucun partage", description: "Le partage de documents arrivera prochainement.", showImport: false };
    case "a-traiter":
      return { title: "Rien à traiter", description: "Tous vos documents sont classés.", showImport: false };
    case "archives":
      return { title: "Aucune archive", description: "Aucun document archivé pour le moment.", showImport: false };
    default:
      return { title: "Aucun document trouvé", description: "Ajustez les filtres ou importez un document.", showImport: true };
  }
}

export default async function DocumentsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const page = numberParam(params, "page", 1);
  // Vue grille par défaut ; bascule en liste uniquement si ?view=table explicite.
  const view = firstParam(params, "view", "") === "table" ? "table" : "grid";
  const tab = firstParam(params, "tab", "") ?? "";
  // Nombre de documents par page (sélecteur), borné aux valeurs autorisées.
  const reqSize = numberParam(params, "taille", DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZES.includes(reqSize) ? reqSize : DEFAULT_PAGE_SIZE;

  // Query des filtres courants (préserve l'état dans le sélecteur + sélection « tout »).
  const currentQueryObj: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (typeof val === "string" && val) currentQueryObj[k] = val;
  }
  const currentQuery = new URLSearchParams(currentQueryObj).toString();
  // Filtres seuls (sans page/taille/view) pour /api/documents/ids (sélection totale).
  const selectAllObj: Record<string, string> = {};
  for (const k of ["query", "correspondent", "document_type", "tag", "created_from", "added_from", "asn", "ordering", "tab"]) {
    const val = firstParam(params, k);
    if (val) selectAllObj[k] = val;
  }
  if (tab) selectAllObj.tab = tab;
  const selectAllQuery = new URLSearchParams(selectAllObj).toString();

  try {
    const unsupported = UNSUPPORTED_TABS.has(tab);
    // 1) Documents (page courante) + taxonomies, en parallèle.
    const [documentsData, correspondentsData, typesData, tagsData] = await Promise.all([
      unsupported
        ? Promise.resolve({ count: 0, results: [] as PaperlessDocument[] })
        : getDocuments(buildDocumentApiParams(params, tab, pageSize)),
      getCorrespondents(),
      getDocumentTypes(),
      getTags(),
    ]);

    const correspondents = correspondentsData.results ?? [];
    const types = typesData.results ?? [];
    const tags = tagsData.results ?? [];
    const paperlessUrl = getPaperlessPublicUrl();
    const rawDocuments = documentsData.results ?? [];

    // 2) Analyses IA + lignes budget : UNIQUEMENT pour les documents de la page
    //    (perf — évite de relire toute la base d'analyses/finances à chaque page).
    const pageDocIds = rawDocuments.map((d) => Number(d.id));
    let analyses: Awaited<ReturnType<typeof listAnalyses>> = [];
    let financialItems: Awaited<ReturnType<typeof listFinancialItems>> = [];
    if (!unsupported && pageDocIds.length > 0) {
      [analyses, financialItems] = await Promise.all([
        listAnalyses({ documentIds: pageDocIds }),
        listFinancialItems({ documentIds: pageDocIds }),
      ]);
    }

    // Filtrage par onglet (vues À traiter / Archives).
    const documents =
      tab === "a-traiter"
        ? rawDocuments.filter((d) => isDocumentToProcess(d, tags))
        : tab === "archives"
        ? rawDocuments.filter(isDocumentArchived)
        : rawDocuments;

    const docs = await buildDocumentVMs(documents, { correspondents, types, tags, analyses, financialItems, paperlessUrl });

    // Filtre « État » (statuts dérivés, non interrogeables côté Gedify) :
    // post-filtrage de la page courante (la pagination reste sur le total Gedify).
    const etat = firstParam(params, "etat");
    const visibleDocs = etat ? docs.filter((d) => matchesEtat(d.statuses, etat)) : docs;

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
    if (tab) hidden.tab = tab;
    const resetHref = `/documents?${new URLSearchParams(hidden).toString()}`;

    const paginationParams = cleanSearchParams(params, [
      "tab",
      "query",
      "correspondent",
      "document_type",
      "tag",
      "created_from",
      "added_from",
      "asn",
      "ordering",
      "etat",
      "view",
      "taille",
    ]);

    const message = emptyMessage(tab);

    // Pagination masquée lorsqu'un filtre d'état est actif (post-filtre page courante).
    const footer =
      visibleDocs.length > 0 && !etat ? (
        <Pagination
          count={documentsData.count}
          page={page}
          pageSize={pageSize}
          basePath="/documents"
          searchParams={paginationParams}
        />
      ) : null;

    return (
      <>
        {/* Mobile (< md) : espace Documents « app » */}
        <Suspense fallback={null}>
          <MobileDocuments
            docs={visibleDocs}
            tab={tab ?? ""}
            filterValues={filterValues}
            correspondents={correspondents.map((c) => ({ id: c.id, name: c.name }))}
            types={types.map((t) => ({ id: t.id, name: t.name }))}
          />
        </Suspense>

        {/* Bureau (≥ md) : layout d'espace complet */}
        <div className="hidden md:block">
      <SpaceLayout
        spaceId="documents"
        actions={
          <>
            <PageSizeSelector value={pageSize} currentQuery={currentQuery} />
            <ViewToggle
              options={[
                { value: "grid", icon: LayoutGrid, label: "Grille" },
                { value: "table", icon: Table2, label: "Liste" },
              ]}
              active={view}
              hrefBuilder={(v) => {
                const usp = new URLSearchParams(hidden);
                usp.set("view", v);
                return `/documents?${usp.toString()}`;
              }}
            />
            <Link
              href="/import"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--blue-600)" }}
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Importer
            </Link>
          </>
        }
      >
        <DocumentSpace
          docs={visibleDocs}
          totalCount={etat ? visibleDocs.length : documentsData.count}
          selectAllQuery={etat ? undefined : selectAllQuery}
          view={view}
          filterValues={filterValues}
          correspondents={correspondents.map((c) => ({ id: c.id, name: c.name }))}
          types={types.map((t) => ({ id: t.id, name: t.name }))}
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
          hidden={hidden}
          resetHref={resetHref}
          footer={footer}
          emptyTitle={message.title}
          emptyDescription={message.description}
          showImport={message.showImport}
          paperlessUrl={paperlessUrl}
        />
      </SpaceLayout>
        </div>
      </>
    );
  } catch (error) {
    return (
      <SpaceLayout spaceId="documents">
        <ErrorState message={error instanceof Error ? error.message : "Erreur inconnue pendant le chargement."} />
      </SpaceLayout>
    );
  }
}
