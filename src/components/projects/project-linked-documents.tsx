"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Unlink,
} from "lucide-react";
import { BadgeTag } from "@/components/ui/badge-tag";
import { DocumentPreview } from "@/components/ui/document-preview";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { getDocumentSubtitle, getTagsForDocument } from "@/lib/document-utils";
import type {
  PaperlessCorrespondent,
  PaperlessDocument,
  PaperlessDocumentType,
  PaperlessTag,
} from "@/lib/paperless-types";

type ProjectLinkedDocumentsProps = {
  projectId: string;
  documents: PaperlessDocument[];
  correspondents: PaperlessCorrespondent[];
  types: PaperlessDocumentType[];
  tags: PaperlessTag[];
  editable?: boolean;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 300] as const;
const DEFAULT_PAGE_SIZE = 20;

export function ProjectLinkedDocuments({
  projectId,
  documents,
  correspondents,
  types,
  tags,
  editable = false,
}: ProjectLinkedDocumentsProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = documents.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Page effective recadrée pendant le rendu (pas de setState dans un effet).
  const safePage = Math.min(Math.max(1, page), totalPages);

  // Ne compte/agit que sur les documents encore liés : la sélection est
  // dérivée pendant le rendu, donc auto-nettoyée après un refresh.
  const selectedValidIds = useMemo(
    () => documents.map((document) => document.id).filter((id) => selected.has(id)),
    [documents, selected],
  );
  const selectedCount = selectedValidIds.length;

  const pageDocuments = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return documents.slice(start, start + pageSize);
  }, [documents, safePage, pageSize]);

  const pageIds = useMemo(() => pageDocuments.map((document) => document.id), [pageDocuments]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const allTotalSelected = total > 0 && selectedCount === total;
  const hasMoreThanPage = total > pageDocuments.length;

  function toggleOne(id: number) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((previous) => {
      const next = new Set(previous);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function selectAllAcrossPages() {
    setSelected(new Set(documents.map((document) => document.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function unlinkDocuments(documentIds: number[]) {
    if (documentIds.length === 0) return;
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/documents/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { details?: string; error?: string };
        throw new Error(data.details || data.error || "Erreur API interne");
      }

      setSelected((previous) => {
        const next = new Set(previous);
        documentIds.forEach((id) => next.delete(id));
        return next;
      });
      router.refresh();
    } catch (unlinkError) {
      setError(
        unlinkError instanceof Error
          ? unlinkError.message
          : "Impossible de retirer les documents du dossier.",
      );
    }
  }

  async function removeSelected() {
    setBulkRemoving(true);
    await unlinkDocuments(selectedValidIds);
    setBulkRemoving(false);
  }

  async function removeOne(id: number) {
    setRemovingId(id);
    await unlinkDocuments([id]);
    setRemovingId(null);
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        title="Aucun document lié"
        description="Ajoutez des documents Gedify à ce dossier pour retrouver toutes les pièces du projet au même endroit."
      />
    );
  }

  const rangeStart = (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);
  const busy = bulkRemoving || removingId !== null;

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      {/* Barre d'outils : sélection + taille de page */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 px-3 py-2">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600"
              checked={allPageSelected}
              ref={(node) => {
                if (node) {
                  node.indeterminate = !allPageSelected && pageIds.some((id) => selected.has(id));
                }
              }}
              onChange={togglePage}
              aria-label="Sélectionner tous les documents de la page"
            />
            {selectedCount > 0 ? `${selectedCount} sélectionné${selectedCount > 1 ? "s" : ""}` : "Tout sélectionner"}
          </label>

          {editable && selectedCount > 0 ? (
            <button
              type="button"
              onClick={removeSelected}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
            >
              {bulkRemoving ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Unlink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              Retirer la sélection ({selectedCount})
            </button>
          ) : null}
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          Afficher
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          par page
        </label>
      </div>

      {/* Bannière « tout sélectionner sur toutes les pages » (style Gmail) */}
      {allPageSelected && hasMoreThanPage ? (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-2 text-sm text-blue-900">
          {allTotalSelected ? (
            <>
              <span className="font-semibold">
                Les {total} documents du dossier sont sélectionnés.
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="font-bold text-blue-700 underline underline-offset-2 hover:text-blue-800"
              >
                Effacer la sélection
              </button>
            </>
          ) : (
            <>
              <span>
                Les {pageIds.length} documents de cette page sont sélectionnés.
              </span>
              <button
                type="button"
                onClick={selectAllAcrossPages}
                className="font-bold text-blue-700 underline underline-offset-2 hover:text-blue-800"
              >
                Sélectionner les {total} documents du dossier
              </button>
            </>
          )}
        </div>
      ) : null}

      {/* Lignes compactes */}
      <ul className="space-y-1.5">
        {pageDocuments.map((document) => {
          const isSelected = selected.has(document.id);
          const documentTags = getTagsForDocument(tags, document).slice(0, 2);

          return (
            <li
              key={document.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                isSelected
                  ? "border-blue-300 bg-blue-50/60"
                  : "border-slate-200 bg-white hover:border-blue-200"
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-blue-600"
                checked={isSelected}
                onChange={() => toggleOne(document.id)}
                aria-label={`Sélectionner ${document.title || `document ${document.id}`}`}
              />

              <DocumentPreview
                documentId={document.id}
                title={document.title}
                fileName={document.original_file_name ?? document.filename}
                mimeType={document.mime_type}
                size="xs"
                showBadge={false}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {document.title || `Document ${document.id}`}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {getDocumentSubtitle(document, correspondents, types) || "Métadonnées à compléter"}
                </p>
              </div>

              <div className="hidden shrink-0 items-center gap-1.5 lg:flex">
                {documentTags.map((tag) => (
                  <BadgeTag key={tag.id} tag={tag} compact />
                ))}
              </div>

              <span className="hidden shrink-0 text-xs font-medium text-slate-400 xl:block">
                {formatDate(document.created ?? document.created_date)}
              </span>

              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/documents/${document.id}`}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                >
                  Détail
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                </Link>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => removeOne(document.id)}
                    disabled={busy}
                    aria-label="Retirer du dossier"
                    title="Retirer du dossier"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                  >
                    {removingId === document.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Unlink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-xs font-medium text-slate-500">
          {rangeStart}–{rangeEnd} sur {total} document{total > 1 ? "s" : ""}
        </p>
        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
            <PagerButton onClick={() => setPage(1)} disabled={safePage === 1} label="Première page">
              <ChevronsLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </PagerButton>
            <PagerButton onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1} label="Page précédente">
              <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </PagerButton>
            <span className="px-2 text-sm font-semibold text-slate-700">
              Page {safePage} / {totalPages}
            </span>
            <PagerButton onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages} label="Page suivante">
              <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </PagerButton>
            <PagerButton onClick={() => setPage(totalPages)} disabled={safePage === totalPages} label="Dernière page">
              <ChevronsRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </PagerButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PagerButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
