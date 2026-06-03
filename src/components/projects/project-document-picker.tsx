"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2, Search } from "lucide-react";
import { BadgeTag } from "@/components/ui/badge-tag";
import { DocumentPreview } from "@/components/ui/document-preview";
import { getDocumentSubtitle, getTagsForDocument } from "@/lib/document-utils";
import { formatDate } from "@/lib/format";
import type {
  PaperlessCorrespondent,
  PaperlessDocument,
  PaperlessDocumentType,
  PaperlessListResponse,
  PaperlessTag,
} from "@/lib/paperless-types";

type ProjectDocumentPickerProps = {
  projectId: string;
  linkedDocumentIds: number[];
  correspondents: PaperlessCorrespondent[];
  types: PaperlessDocumentType[];
  tags: PaperlessTag[];
};

const FIELD_CLASS =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";
const LABEL_CLASS = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";

export function ProjectDocumentPicker({
  projectId,
  linkedDocumentIds,
  correspondents,
  types,
  tags,
}: ProjectDocumentPickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [correspondent, setCorrespondent] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [tag, setTag] = useState("");
  const [results, setResults] = useState<PaperlessDocument[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchDocuments() {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page_size: "12",
      ordering: "-added",
    });

    if (query.trim()) params.set("query", query.trim());
    if (correspondent) params.set("correspondent__id", correspondent);
    if (documentType) params.set("document_type__id", documentType);
    if (tag) params.set("tags__id__all", tag);

    try {
      const response = await fetch(`/api/paperless/documents?${params.toString()}`);
      const data = (await response.json()) as PaperlessListResponse<PaperlessDocument> & {
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        throw new Error(data.details || data.error || "Erreur API interne");
      }

      setResults(data.results.filter((document) => !linkedDocumentIds.includes(document.id)));
      setSelectedIds([]);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Impossible de rechercher les documents Gedify."
      );
    } finally {
      setLoading(false);
    }
  }

  async function linkSelectedDocuments() {
    setLinking(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/documents/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: selectedIds }),
      });

      const data = (await response.json()) as { details?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.details || data.error || "Erreur API interne");
      }

      setSelectedIds([]);
      router.refresh();
    } catch (linkError) {
      setError(
        linkError instanceof Error
          ? linkError.message
          : "Impossible d'ajouter les documents au dossier."
      );
    } finally {
      setLinking(false);
    }
  }

  function toggleSelected(documentId: number) {
    setSelectedIds((current) =>
      current.includes(documentId)
        ? current.filter((item) => item !== documentId)
        : [...current, documentId]
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(150px,1fr))_auto]">
        <label>
          <span className={LABEL_CLASS}>Recherche</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={FIELD_CLASS}
            placeholder="Titre, contenu OCR, facture..."
          />
        </label>
        <label>
          <span className={LABEL_CLASS}>Correspondant</span>
          <select
            value={correspondent}
            onChange={(event) => setCorrespondent(event.target.value)}
            className={FIELD_CLASS}
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
          <span className={LABEL_CLASS}>Type</span>
          <select
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            className={FIELD_CLASS}
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
          <span className={LABEL_CLASS}>Tag</span>
          <select value={tag} onChange={(event) => setTag(event.target.value)} className={FIELD_CLASS}>
            <option value="">Tous</option>
            {tags.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={searchDocuments}
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.35)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60 lg:w-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            Rechercher
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3">
        {results.map((document) => {
          const selected = selectedIds.includes(document.id);
          const documentTags = getTagsForDocument(tags, document).slice(0, 3);

          return (
            <button
              key={document.id}
              type="button"
              onClick={() => toggleSelected(document.id)}
              className={`flex flex-col gap-4 rounded-3xl border p-4 text-left transition sm:flex-row ${
                selected
                  ? "border-blue-300 bg-blue-50/70 ring-4 ring-blue-100"
                  : "border-slate-200 bg-white hover:border-blue-200"
              }`}
            >
              <DocumentPreview
                documentId={document.id}
                title={document.title}
                fileName={document.original_file_name ?? document.filename}
                mimeType={document.mime_type}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-extrabold text-slate-950">
                  {document.title || `Document ${document.id}`}
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  {getDocumentSubtitle(document, correspondents, types) || "Métadonnées à compléter"}
                </span>
                <span className="mt-1 block text-xs font-medium text-slate-400">
                  Date document : {formatDate(document.created ?? document.created_date)}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {documentTags.map((item) => (
                    <BadgeTag key={item.id} tag={item} compact />
                  ))}
                </span>
              </span>
              <span
                className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  selected ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                }`}
                aria-hidden="true"
              >
                {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      {results.length === 0 && !loading ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm font-medium text-slate-500">
          Lancez une recherche pour sélectionner des documents Gedify à ajouter au dossier.
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={linkSelectedDocuments}
          disabled={selectedIds.length === 0 || linking}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.35)] transition hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60"
        >
          {linking ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <FilePlus2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          Ajouter au dossier
        </button>
      </div>
    </div>
  );
}
