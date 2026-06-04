import Link from "next/link";
import { ArrowRight, CalendarDays, ExternalLink, Hash } from "lucide-react";
import { BadgeTag } from "@/components/ui/badge-tag";
import { DocumentPreview } from "@/components/ui/document-preview";
import { formatDate } from "@/lib/format";
import {
  getDocumentSubtitle,
  getTagsForDocument,
  isDocumentArchived,
  isDocumentWithAsn,
} from "@/lib/document-utils";
import {
  getDocumentDisplayTitle,
  type ResolvedDocumentTitle,
} from "@/lib/documents/document-title-utils";
import type {
  PaperlessCorrespondent,
  PaperlessDocument,
  PaperlessDocumentType,
  PaperlessTag,
} from "@/lib/paperless-types";

type DocumentCardProps = {
  document: PaperlessDocument;
  correspondents: PaperlessCorrespondent[];
  types: PaperlessDocumentType[];
  tags: PaperlessTag[];
  paperlessUrl: string | null;
  resolvedTitle?: ResolvedDocumentTitle;
  /** Extrait OCR surligné (HTML sûr avec <mark>) issu de la recherche. */
  snippet?: string | null;
};

export function DocumentCard({
  document,
  correspondents,
  types,
  tags,
  paperlessUrl,
  resolvedTitle,
  snippet,
}: DocumentCardProps) {
  const documentTags = getTagsForDocument(tags, document);
  const subtitle = getDocumentSubtitle(document, correspondents, types);
  const fileName = document.original_file_name ?? document.original_filename ?? document.filename;
  const mimeType = document.mime_type ?? null;
  const title =
    resolvedTitle ?? getDocumentDisplayTitle({ document, override: null });
  const fileNameHint =
    title.originalFilename && title.originalFilename !== title.displayTitle
      ? title.originalFilename
      : null;

  return (
    <article
      className="group rounded-[22px] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start gap-4">
        <DocumentPreview
          documentId={document.id}
          title={document.title}
          fileName={fileName}
          mimeType={mimeType}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/documents/${document.id}`}
                className="text-sm font-bold leading-snug transition-colors hover:opacity-80 truncate block"
                style={{ color: "var(--text-main)" }}
                title={
                  fileNameHint
                    ? `${title.displayTitle}\nFichier : ${fileNameHint}`
                    : title.displayTitle
                }
              >
                {title.displayTitle}
              </Link>
              <p
                className="mt-1 line-clamp-2 text-xs"
                style={{ color: "var(--text-muted)" }}
                title={fileNameHint ?? undefined}
              >
                {subtitle || fileNameHint || "Métadonnées principales à compléter"}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--gedify-info-soft)", color: "var(--gedify-info)" }}>
              <Hash className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              {document.id}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div>
              <dt className="flex items-center gap-1.5 font-semibold text-slate-400">
                <CalendarDays className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                Document
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                {formatDate(document.created)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 font-semibold text-slate-400">
                <CalendarDays className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                Ajout
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                {formatDate(document.added)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">ASN</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                {isDocumentWithAsn(document) ? document.archive_serial_number : "Aucun"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">Archive</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-800">
                {isDocumentArchived(document) ? "Disponible" : "Non générée"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {snippet ? (
        <p
          className="mt-3 line-clamp-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 [&_mark]:rounded [&_mark]:bg-amber-200 [&_mark]:px-0.5 [&_mark]:text-slate-900"
          dangerouslySetInnerHTML={{ __html: snippet }}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {documentTags.length > 0 ? (
          documentTags.slice(0, 5).map((tag) => <BadgeTag key={tag.id} tag={tag} compact />)
        ) : (
          <span className="text-xs font-medium text-slate-400">Aucun tag</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-4" style={{ borderTop: "1px solid var(--border-soft)" }}>
        <Link
          href={`/documents/${document.id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--gedify-navy)" }}
        >
          Voir le détail
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>
        {paperlessUrl ? (
          <a
            href={`${paperlessUrl}/documents/${document.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition hover:bg-slate-50"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)", background: "white" }}
          >
            Gedify
            <ExternalLink className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
