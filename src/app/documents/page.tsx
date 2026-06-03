import { Suspense } from "react";
import Link from "next/link";
import { LayoutGrid, Plus, Table2 } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { MobileDocuments } from "@/components/mobile/mobile-documents";
import { Pagination } from "@/components/ui/pagination";
import { ViewToggle } from "@/components/ui/view-toggle";
import { SpaceLayout } from "@/components/layout/space-layout";
import { DocumentSpace } from "@/components/documents/document-space";
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

const pageSize = 24;

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

  try {
    const unsupported = UNSUPPORTED_TABS.has(tab);
    const [documentsData, correspondentsData, typesData, tagsData, analyses, financialItems] = await Promise.all([
      unsupported
        ? Promise.resolve({ count: 0, results: [] as PaperlessDocument[] })
        : getDocuments(buildDocumentApiParams(params, tab, pageSize)),
      getCorrespondents(),
      getDocumentTypes(),
      getTags(),
      unsupported ? Promise.resolve([]) : listAnalyses(),
      unsupported ? Promise.resolve([]) : listFinancialItems({}),
    ]);

    const correspondents = correspondentsData.results ?? [];
    const types = typesData.results ?? [];
    const tags = tagsData.results ?? [];
    const paperlessUrl = getPaperlessPublicUrl();
    const rawDocuments = documentsData.results ?? [];

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
