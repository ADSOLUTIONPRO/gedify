import Link from "next/link";
import { DocumentPreview } from "@/components/ui/document-preview";
import { StatusPill } from "@/components/ui/status-pill";
import {
  getDocumentSubtitle,
  getTagsForDocument,
  isDocumentArchived,
  isDocumentToProcess,
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

type DocumentGridTileProps = {
  document: PaperlessDocument;
  correspondents: PaperlessCorrespondent[];
  types: PaperlessDocumentType[];
  tags: PaperlessTag[];
  resolvedTitle?: ResolvedDocumentTitle;
};

export function DocumentGridTile({
  document,
  correspondents,
  types,
  tags,
  resolvedTitle,
}: DocumentGridTileProps) {
  const fileName = document.original_file_name ?? document.original_filename ?? document.filename;
  const mimeType = document.mime_type ?? null;
  const subtitle = getDocumentSubtitle(document, correspondents, types);
  const documentTags = getTagsForDocument(tags, document);
  const archived = isDocumentArchived(document);
  const toProcess = isDocumentToProcess(document, tags);
  const title =
    resolvedTitle ?? getDocumentDisplayTitle({ document, override: null });
  const fileNameHint =
    title.originalFilename && title.originalFilename !== title.displayTitle
      ? title.originalFilename
      : null;

  return (
    <Link
      href={`/documents/${document.id}`}
      className="group flex flex-col gap-3 rounded-2xl bg-white p-3 transition hover:shadow-md"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "0 1px 8px -2px rgba(8,18,37,0.06)",
      }}
    >
      <div
        className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl"
        style={{ background: "linear-gradient(180deg, #F5F8FC 0%, #ECF2FB 100%)" }}
      >
        <DocumentPreview
          documentId={document.id}
          title={document.title}
          fileName={fileName}
          mimeType={mimeType}
          size="lg"
          className="!h-full !w-full !rounded-none !border-0 !shadow-none !bg-transparent"
        />
        <span
          className="absolute right-2 top-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: "white", color: "var(--text-muted)", boxShadow: "0 1px 3px rgba(8,18,37,0.08)" }}
        >
          #{document.id}
        </span>
      </div>

      <div className="min-w-0">
        <p
          className="truncate text-sm font-bold leading-snug"
          style={{ color: "var(--text-main)" }}
          title={
            fileNameHint
              ? `${title.displayTitle}\nFichier : ${fileNameHint}`
              : title.displayTitle
          }
        >
          {title.displayTitle}
        </p>
        <p
          className="mt-0.5 truncate text-[11px]"
          style={{ color: "var(--text-muted)" }}
          title={fileNameHint ?? undefined}
        >
          {subtitle || fileNameHint || "Métadonnées à compléter"}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        {toProcess ? (
          <StatusPill tone="amber" dot>
            À traiter
          </StatusPill>
        ) : archived ? (
          <StatusPill tone="emerald" dot>
            Archivé
          </StatusPill>
        ) : (
          <StatusPill tone="emerald" dot>
            Validé
          </StatusPill>
        )}
        {documentTags.length > 0 ? (
          <span
            className="truncate text-[11px] font-semibold"
            style={{ color: "var(--text-muted)" }}
            title={documentTags.map((t) => t.name).join(", ")}
          >
            {documentTags[0].name}
            {documentTags.length > 1 ? ` +${documentTags.length - 1}` : ""}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
