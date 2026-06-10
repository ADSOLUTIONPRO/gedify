import type { Metadata } from "next";
import Link from "next/link";
import { FolderTree as FolderTreeIcon, LayoutGrid, Table2 } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { ViewToggle } from "@/components/ui/view-toggle";
import { SpaceLayout } from "@/components/layout/space-layout";
import { DocumentSpace } from "@/components/documents/document-space";
import type { DocumentFilterValues } from "@/components/documents/document-filters";
import { listProjectFolders } from "@/lib/projects/project-store";
import { computeFolderPath, indexFoldersById } from "@/lib/projects/project-utils";
import { FolderPinButton } from "@/components/dashboard/folder-pin-button";
import { FolderImportButton } from "@/components/projects/folder-import-button";
import { FolderDropZone } from "@/components/projects/folder-drop-zone";
import { isPinned } from "@/lib/dashboard/pinned-store";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildDocumentApiParams, buildDocumentVMs, matchesEtat } from "@/lib/documents/document-list-loader";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { getCorrespondents, getDocumentTypes, getDocuments, getPaperlessPublicUrl, getTags } from "@/lib/paperless";
import { firstParam, type PageSearchParams } from "@/lib/page-params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dossiers / Projets — Organiser" };

export default async function OrganiserDossiersPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  try {
    const projects = await listProjectFolders();
    const byId = indexFoldersById(projects);

    const folderParam = firstParam(params, "folder");
    const selected = (folderParam ? projects.find((p) => p.id === folderParam) : null) ?? projects[0] ?? null;

    // Taxonomies (filtres) + documents du dossier sélectionné.
    const [correspondentsData, typesData, tagsData] = await Promise.all([
      getCorrespondents(),
      getDocumentTypes(),
      getTags(),
    ]);
    const correspondents = correspondentsData.results ?? [];
    const types = typesData.results ?? [];
    const tags = tagsData.results ?? [];
    const paperlessUrl = getPaperlessPublicUrl();

    const linkedIds = selected?.linkedDocumentIds ?? [];
    let docs = [] as Awaited<ReturnType<typeof buildDocumentVMs>>;
    if (selected && linkedIds.length > 0) {
      // Analyses IA + budget bornées aux documents du dossier (perf — au lieu de
      // relire toute la base). Pushdown SQL en mode Postgres.
      const docIds = linkedIds.map(Number).filter(Number.isFinite);
      const apiParams = { ...buildDocumentApiParams(params, "", 200), id__in: linkedIds.join(",") };
      const [documentsData, analyses, financialItems] = await Promise.all([
        getDocuments(apiParams),
        listAnalyses({ documentIds: docIds }),
        listFinancialItems({ documentIds: docIds }),
      ]);
      docs = await buildDocumentVMs(documentsData.results ?? [], { correspondents, types, tags, analyses, financialItems, paperlessUrl });
    }

    const etat = firstParam(params, "etat");
    const visibleDocs = etat ? docs.filter((d) => matchesEtat(d.statuses, etat)) : docs;
    const view = firstParam(params, "view", "") === "table" ? "table" : "grid";

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
    if (selected) hidden.folder = selected.id;
    const resetHref = `/organiser/dossiers${selected ? `?folder=${selected.id}` : ""}`;
    const selectedPath = selected ? computeFolderPath(selected, byId) : "";

    // État épinglé du dossier ouvert (par utilisateur) pour l'en-tête.
    const currentUser = await getCurrentUser();
    const folderPinned = selected ? await isPinned(currentUser ? String(currentUser.id) : "local", "folder", selected.id).catch(() => false) : false;

    return (
      <SpaceLayout spaceId="organiser">
        {selected ? (
          <>
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11.5px] font-semibold" style={{ color: "var(--text-muted)" }}>{selectedPath}</p>
                <h1 className="flex items-center gap-2 text-[18px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
                  <span className="h-3 w-3 rounded-sm" style={{ background: selected.color || "#F97316" }} aria-hidden="true" />
                  {selected.name}
                  <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-muted)" }}>· {linkedIds.length} document{linkedIds.length > 1 ? "s" : ""}</span>
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <ViewToggle
                  options={[
                    { value: "grid", icon: LayoutGrid, label: "Grille" },
                    { value: "table", icon: Table2, label: "Liste" },
                  ]}
                  active={view}
                  hrefBuilder={(v) => {
                    const usp = new URLSearchParams(hidden);
                    usp.set("view", v);
                    return `/organiser/dossiers?${usp.toString()}`;
                  }}
                />
                <FolderPinButton
                  entityId={selected.id}
                  initialPinned={folderPinned}
                  iconOnly
                  className="flex h-9 w-9 items-center justify-center rounded-xl border bg-white transition hover:bg-[var(--bg-card-soft)]"
                />
                {/* Import direct dans le dossier ouvert (bouton + glisser-déposer). */}
                <FolderImportButton folderId={selected.id} folderName={selected.name} />
              </div>
            </header>

            {/* parent `relative` : la FolderDropZone couvre la zone de contenu. */}
            <div className="relative">
              <FolderDropZone folderId={selected.id} folderName={selected.name} />
              <DocumentSpace
                docs={visibleDocs}
                totalCount={visibleDocs.length}
                view={view}
                filterValues={filterValues}
                correspondents={correspondents.map((c) => ({ id: c.id, name: c.name }))}
                types={types.map((t) => ({ id: t.id, name: t.name }))}
                tags={tags.map((t) => ({ id: t.id, name: t.name }))}
                hidden={hidden}
                resetHref={resetHref}
                footer={null}
                emptyTitle={linkedIds.length === 0 ? "Dossier vide" : "Aucun document ne correspond"}
                emptyDescription={linkedIds.length === 0 ? "Glissez des fichiers ici ou utilisez « Importer dans ce dossier » pour ajouter des documents." : "Ajustez les filtres."}
                showImport={false}
                paperlessUrl={paperlessUrl}
                basePath="/organiser/dossiers"
              />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border bg-white px-6 py-16 text-center" style={{ borderColor: "var(--border)" }}>
            <FolderTreeIcon className="mx-auto mb-3 h-9 w-9" style={{ color: "var(--text-hint)" }} strokeWidth={1.5} />
            <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Aucun dossier</p>
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Créez un dossier dans la barre de gauche pour commencer.</p>
          </div>
        )}
      </SpaceLayout>
    );
  } catch (error) {
    return (
      <SpaceLayout spaceId="organiser">
        <ErrorState message={error instanceof Error ? error.message : "Erreur pendant le chargement des dossiers."} />
      </SpaceLayout>
    );
  }
}
