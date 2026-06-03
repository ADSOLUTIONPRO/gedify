import "server-only";

import path from "node:path";
import {
  readStore,
  STORE,
  type EngineDocument,
  type EngineNamed,
  type EngineTag,
} from "./stores";
import type { PaperlessDocument } from "@/lib/paperless-types";

/* ── Correspondances MIME ↔ extension (jeu courant GED) ─────────────────── */
const MIME_BY_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".html": "text/html",
  ".htm": "text/html",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
};
const EXT_BY_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_BY_EXT).map(([ext, mime]) => [mime, ext]),
);

export function mimeFromExt(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? "application/octet-stream";
}
export function extFromMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "";
}
export function baseName(filename: string): string {
  const b = path.basename(filename, path.extname(filename));
  return b || filename || "Document";
}

/* ── Cartes de noms (id → nom) pour la dénormalisation ──────────────────── */
export type NameMaps = {
  correspondents: Map<number, string>;
  document_types: Map<number, string>;
  storage_paths: Map<number, string>;
  tags: Map<number, string>;
};

export async function loadNameMaps(): Promise<NameMaps> {
  const [corr, types, paths, tags] = await Promise.all([
    readStore<EngineNamed[]>(STORE.correspondents, []),
    readStore<EngineNamed[]>(STORE.document_types, []),
    readStore<Array<{ id: number; name: string }>>(STORE.storage_paths, []),
    readStore<EngineTag[]>(STORE.tags, []),
  ]);
  return {
    correspondents: new Map(corr.map((c) => [c.id, c.name])),
    document_types: new Map(types.map((t) => [t.id, t.name])),
    storage_paths: new Map(paths.map((p) => [p.id, p.name])),
    tags: new Map(tags.map((t) => [t.id, t.name])),
  };
}

/* ── Compteurs de documents par taxonomie (documents non supprimés) ─────── */
export type DocCounts = {
  correspondent: Map<number, number>;
  document_type: Map<number, number>;
  storage_path: Map<number, number>;
  tag: Map<number, number>;
};

export async function loadDocCounts(): Promise<DocCounts> {
  const docs = (await readStore<EngineDocument[]>(STORE.documents, [])).filter((d) => !d.deleted);
  const counts: DocCounts = {
    correspondent: new Map(),
    document_type: new Map(),
    storage_path: new Map(),
    tag: new Map(),
  };
  const inc = (m: Map<number, number>, k: number | null | undefined) => {
    if (k == null) return;
    m.set(k, (m.get(k) ?? 0) + 1);
  };
  for (const d of docs) {
    inc(counts.correspondent, d.correspondent);
    inc(counts.document_type, d.document_type);
    inc(counts.storage_path, d.storage_path);
    for (const t of d.tags ?? []) inc(counts.tag, t);
  }
  return counts;
}

/* ── Sérialisation EngineDocument → PaperlessDocument (forme API) ────────── */
export function serializeDocument(doc: EngineDocument, maps: NameMaps): PaperlessDocument {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    created: doc.created,
    created_date: doc.created_date,
    added: doc.added,
    modified: doc.modified,
    correspondent: doc.correspondent,
    correspondent__name: doc.correspondent != null ? maps.correspondents.get(doc.correspondent) ?? null : null,
    document_type: doc.document_type,
    document_type__name: doc.document_type != null ? maps.document_types.get(doc.document_type) ?? null : null,
    storage_path: doc.storage_path,
    storage_path__name: doc.storage_path != null ? maps.storage_paths.get(doc.storage_path) ?? null : null,
    tags: doc.tags ?? [],
    archive_serial_number: doc.archive_serial_number,
    original_file_name: doc.original_file_name,
    archived_file_name: null,
    filename: doc.original_file_name,
    archive_filename: null,
    original_filename: doc.original_file_name,
    mime_type: doc.mime_type,
    page_count: doc.page_count,
    notes: doc.notes ?? [],
    owner: doc.owner,
    user_can_change: true,
    // Champs personnalisés (forme Paperless : { field, value }[])
    ...(doc.custom_fields ? { custom_fields: doc.custom_fields } : {}),
  } as PaperlessDocument;
}
