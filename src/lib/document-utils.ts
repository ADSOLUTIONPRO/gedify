import type {
  PaperlessCorrespondent,
  PaperlessDocument,
  PaperlessDocumentType,
  PaperlessId,
  PaperlessTag,
} from "@/lib/paperless-types";

export function getNameById<T extends { id: PaperlessId; name: string }>(
  items: T[],
  id?: PaperlessId | null
) {
  if (!id) {
    return null;
  }

  return items.find((item) => item.id === id)?.name ?? null;
}

export function getTagsForDocument(tags: PaperlessTag[], document: PaperlessDocument) {
  const ids = new Set(document.tags ?? []);
  return tags.filter((tag) => ids.has(tag.id));
}

export function isDocumentArchived(document: PaperlessDocument) {
  return Boolean(document.archived_file_name || document.archive_filename);
}

export function isDocumentWithAsn(document: PaperlessDocument) {
  return document.archive_serial_number !== null && document.archive_serial_number !== undefined;
}

export function isDocumentToProcess(document: PaperlessDocument, tags: PaperlessTag[]) {
  const documentTags = getTagsForDocument(tags, document);
  const hasProcessingTag = documentTags.some((tag) =>
    /^(a traiter|à traiter|inbox)$/i.test(tag.name)
  );

  return (
    hasProcessingTag ||
    !document.correspondent ||
    !document.document_type ||
    (document.tags ?? []).length === 0
  );
}

export function getDocumentSubtitle(
  document: PaperlessDocument,
  correspondents: PaperlessCorrespondent[],
  types: PaperlessDocumentType[]
) {
  const correspondent =
    document.correspondent__name ?? getNameById(correspondents, document.correspondent);
  const documentType = document.document_type__name ?? getNameById(types, document.document_type);

  return [correspondent, documentType].filter(Boolean).join(" · ");
}
