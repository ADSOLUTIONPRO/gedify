import "server-only";

import path from "node:path";
import {
  deleteOriginal,
  deletePreview,
  deleteThumbnail,
  mutateList,
  nextId,
  readOriginal,
  readStore,
  readThumbnail,
  saveThumbnail,
  slugify,
  STORE,
  type EngineDocument,
  type EngineObject,
} from "./stores";
import { indexDocument, moreLikeIds, removeFromIndex, searchIds } from "./search";
import { loadDocCounts, loadNameMaps, mimeFromExt, serializeDocument } from "./helpers";
import { makeThumbnail } from "./thumbnails";
import { consume, type ConsumeInput } from "./consume";
import { ENGINE_VERSION, getRemoteVersion, getStatistics, getSystemStatus } from "./status";
import { createUser, deleteUser, listUsers, primaryProfile, publicUser, updateUser } from "./users";
import type { PaperlessTask } from "@/lib/paperless-types";

/* ════════════════════════════════════════════════════════════════════════
   Routeur HTTP local « Paperless-compatible ».
   handle(endpoint, options) renvoie un objet Response (JSON ou binaire) avec
   les mêmes formes que Paperless-ngx, pour que la surcouche fonctionne sans
   modification. Branché via le shim src/lib/paperless.ts.
   ════════════════════════════════════════════════════════════════════════ */

export type EngineRequestOptions = {
  method?: string;
  body?: unknown;
  searchParams?: URLSearchParams | Record<string, string | number | boolean | null | undefined>;
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "x-version": ENGINE_VERSION,
  "x-api-version": "9",
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}
function noContent() {
  return new Response(null, { status: 204, headers: { "x-version": ENGINE_VERSION } });
}
function notFound(detail = "Not found.") {
  return json({ detail }, 404);
}
function badRequest(detail: string) {
  return json({ detail }, 400);
}

/* ── Lecture du corps (JSON) ────────────────────────────────────────────── */
function readJsonBody(body: unknown): Record<string, unknown> {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof body === "object" && !(body instanceof FormData)) return body as Record<string, unknown>;
  return {};
}

/* ── Utilitaires de filtre ──────────────────────────────────────────────── */
function parseIds(v: string | null): number[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}
const isTrue = (v: string | null) => v === "true" || v === "1";
const isFalse = (v: string | null) => v === "false" || v === "0";

const TAG_COLORS = ["#F75C8D", "#7C3AED", "#16A34A", "#F59E0B", "#2563EB", "#B0894F", "#0EA5E9", "#DB2777"];
function randomColor() {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

/* ════════════════ Documents : liste ════════════════ */
async function listDocuments(query: URLSearchParams): Promise<Response> {
  const all = (await readStore<EngineDocument[]>(STORE.documents, [])).filter((d) => !d.deleted);
  const maps = await loadNameMaps();
  let docs = all;
  let scoreById: Map<number, number> | null = null;

  const q = query.get("query");
  if (q && q.trim()) {
    const hits = await searchIds(q);
    scoreById = new Map(hits.map((h) => [h.id, h.score]));
    docs = docs.filter((d) => scoreById!.has(d.id));
  }

  const moreLike = query.get("more_like_id");
  if (moreLike) {
    const seed = all.find((d) => d.id === Number(moreLike));
    if (seed) {
      const ids = new Set(await moreLikeIds(seed.id, seed.title, seed.content));
      docs = docs.filter((d) => ids.has(d.id));
    } else {
      docs = [];
    }
  }

  const titleIc = query.get("title__icontains");
  if (titleIc) docs = docs.filter((d) => d.title.toLowerCase().includes(titleIc.toLowerCase()));
  const contentIc = query.get("content__icontains");
  if (contentIc) docs = docs.filter((d) => (d.content ?? "").toLowerCase().includes(contentIc.toLowerCase()));

  // Correspondant
  const corrNull = query.get("correspondent__isnull");
  if (isTrue(corrNull)) docs = docs.filter((d) => d.correspondent == null);
  else if (isFalse(corrNull)) docs = docs.filter((d) => d.correspondent != null);
  const corrId = query.get("correspondent__id");
  if (corrId) docs = docs.filter((d) => String(d.correspondent) === corrId);
  const corrIn = parseIds(query.get("correspondent__id__in"));
  if (corrIn.length) docs = docs.filter((d) => d.correspondent != null && corrIn.includes(d.correspondent));

  // Type de document
  const typeNull = query.get("document_type__isnull");
  if (isTrue(typeNull)) docs = docs.filter((d) => d.document_type == null);
  else if (isFalse(typeNull)) docs = docs.filter((d) => d.document_type != null);
  const typeId = query.get("document_type__id");
  if (typeId) docs = docs.filter((d) => String(d.document_type) === typeId);
  const typeIn = parseIds(query.get("document_type__id__in"));
  if (typeIn.length) docs = docs.filter((d) => d.document_type != null && typeIn.includes(d.document_type));

  // Chemin de stockage
  const spIn = parseIds(query.get("storage_path__id__in"));
  if (spIn.length) docs = docs.filter((d) => d.storage_path != null && spIn.includes(d.storage_path));
  const spId = query.get("storage_path__id");
  if (spId) docs = docs.filter((d) => String(d.storage_path) === spId);

  // Tags
  const tagsAll = parseIds(query.get("tags__id__all"));
  if (tagsAll.length) docs = docs.filter((d) => tagsAll.every((t) => d.tags.includes(t)));
  const tagsIn = parseIds(query.get("tags__id__in"));
  if (tagsIn.length) docs = docs.filter((d) => d.tags.some((t) => tagsIn.includes(t)));
  const tagsNone = parseIds(query.get("tags__id__none"));
  if (tagsNone.length) docs = docs.filter((d) => !d.tags.some((t) => tagsNone.includes(t)));
  const isTagged = query.get("is_tagged");
  if (isTrue(isTagged)) docs = docs.filter((d) => d.tags.length > 0);
  else if (isFalse(isTagged)) docs = docs.filter((d) => d.tags.length === 0);

  // Dates
  const cGte = query.get("created__date__gte");
  if (cGte) docs = docs.filter((d) => d.created_date >= cGte);
  const cLte = query.get("created__date__lte");
  if (cLte) docs = docs.filter((d) => d.created_date <= cLte);
  const aGte = query.get("added__date__gte");
  if (aGte) docs = docs.filter((d) => d.added.slice(0, 10) >= aGte);
  const aLte = query.get("added__date__lte");
  if (aLte) docs = docs.filter((d) => d.added.slice(0, 10) <= aLte);

  const asn = query.get("archive_serial_number");
  if (asn) docs = docs.filter((d) => String(d.archive_serial_number ?? "") === asn);
  const idIn = parseIds(query.get("id__in"));
  if (idIn.length) docs = docs.filter((d) => idIn.includes(d.id));

  // Tri
  const ordering = query.get("ordering");
  if (!ordering && scoreById) {
    docs = [...docs].sort((a, b) => (scoreById!.get(b.id) ?? 0) - (scoreById!.get(a.id) ?? 0));
  } else {
    docs = sortDocuments(docs, ordering ?? "-created", maps.correspondents, maps.document_types);
  }

  // Pagination
  const page = Math.max(1, parseInt(query.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100000, Math.max(1, parseInt(query.get("page_size") ?? "25", 10) || 25));
  const count = docs.length;
  const start = (page - 1) * pageSize;
  const pageItems = docs.slice(start, start + pageSize);
  const results = pageItems.map((d) => {
    const s = serializeDocument(d, maps);
    if (scoreById) s.__search_hit__ = { score: scoreById.get(d.id) };
    return s;
  });

  return json({
    count,
    next: start + pageSize < count ? `?page=${page + 1}&page_size=${pageSize}` : null,
    previous: page > 1 ? `?page=${page - 1}&page_size=${pageSize}` : null,
    all: docs.map((d) => d.id),
    results,
  });
}

function sortDocuments(
  docs: EngineDocument[],
  ordering: string,
  corr: Map<number, string>,
  types: Map<number, string>,
): EngineDocument[] {
  const desc = ordering.startsWith("-");
  const field = desc ? ordering.slice(1) : ordering;
  const val = (d: EngineDocument): string | number => {
    switch (field) {
      case "title":
        return d.title.toLowerCase();
      case "added":
        return d.added;
      case "archive_serial_number":
        return Number(d.archive_serial_number ?? 0);
      case "correspondent__name":
        return (d.correspondent != null ? corr.get(d.correspondent) ?? "" : "").toLowerCase();
      case "document_type__name":
        return (d.document_type != null ? types.get(d.document_type) ?? "" : "").toLowerCase();
      case "created":
      default:
        return d.created;
    }
  };
  const sorted = [...docs].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });
  return desc ? sorted.reverse() : sorted;
}

/* ════════════════ Documents : détail / patch / suppression ════════════════ */
async function getDocument(id: number): Promise<Response> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  const doc = docs.find((d) => d.id === id);
  if (!doc || doc.deleted) return notFound("Document introuvable.");
  const maps = await loadNameMaps();
  return json(serializeDocument(doc, maps));
}

async function patchDocument(id: number, body: Record<string, unknown>): Promise<Response> {
  let updated: EngineDocument | null = null;
  await mutateList<EngineDocument>(STORE.documents, (list) =>
    list.map((d) => {
      if (d.id !== id) return d;
      updated = applyDocumentPatch(d, body);
      return updated;
    }),
  );
  if (!updated) return notFound("Document introuvable.");
  const maps = await loadNameMaps();
  await indexDocument(updated, maps.correspondents, maps.document_types, maps.tags);
  return json(serializeDocument(updated, maps));
}

function applyDocumentPatch(d: EngineDocument, body: Record<string, unknown>): EngineDocument {
  const next: EngineDocument = { ...d, modified: new Date().toISOString() };
  if ("title" in body && typeof body.title === "string") next.title = body.title;
  if ("content" in body && typeof body.content === "string") next.content = body.content;
  if ("correspondent" in body) next.correspondent = toIdOrNull(body.correspondent);
  if ("document_type" in body) next.document_type = toIdOrNull(body.document_type);
  if ("storage_path" in body) next.storage_path = toIdOrNull(body.storage_path);
  if ("tags" in body && Array.isArray(body.tags)) next.tags = (body.tags as unknown[]).map(Number).filter((n) => Number.isFinite(n));
  if ("archive_serial_number" in body) {
    const asn = body.archive_serial_number;
    const n = asn == null || asn === "" ? null : Number(asn);
    next.archive_serial_number = n != null && Number.isFinite(n) ? n : null;
  }
  if ("created" in body && typeof body.created === "string" && body.created) {
    next.created = body.created;
    next.created_date = body.created.slice(0, 10);
  }
  if ("notes" in body && Array.isArray(body.notes)) next.notes = body.notes as EngineDocument["notes"];
  if ("custom_fields" in body && Array.isArray(body.custom_fields)) {
    next.custom_fields = body.custom_fields as EngineDocument["custom_fields"];
  }
  return next;
}
function toIdOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function trashDocument(id: number): Promise<Response> {
  let found = false;
  await mutateList<EngineDocument>(STORE.documents, (list) =>
    list.map((d) => {
      if (d.id !== id) return d;
      found = true;
      return { ...d, deleted: true, deletedAt: new Date().toISOString() };
    }),
  );
  if (!found) return notFound("Document introuvable.");
  await removeFromIndex(id);
  return noContent();
}

/* ════════════════ Documents : binaires (thumb / preview / download) ════════ */
async function fileResponse(id: number, kind: "thumb" | "preview" | "download"): Promise<Response> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  const doc = docs.find((d) => d.id === id);
  if (!doc) return notFound("Document introuvable.");

  if (kind === "thumb") {
    let thumb = await readThumbnail(id);
    if (!thumb) {
      const orig = await readOriginal(doc.storedFilename);
      if (orig) {
        thumb = await makeThumbnail(orig, doc.mime_type ?? "", path.extname(doc.storedFilename));
        await saveThumbnail(id, thumb);
      }
    }
    if (!thumb) return notFound("Vignette indisponible.");
    // Miniature ~immuable par id : cache navigateur + revalidation par ETag.
    // (id jamais réutilisé ; la longueur change si la miniature est régénérée.)
    return new Response(new Uint8Array(thumb), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600, must-revalidate",
        ETag: `"t-${id}-${thumb.length}"`,
      },
    });
  }

  const orig = await readOriginal(doc.storedFilename);
  if (!orig) return notFound("Fichier introuvable.");
  const filename = (doc.original_file_name || `document-${id}${path.extname(doc.storedFilename)}`).replace(/["\\]/g, "_");
  const disposition = kind === "download" ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`;
  return new Response(new Uint8Array(orig), {
    status: 200,
    headers: {
      "Content-Type": doc.mime_type ?? "application/octet-stream",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
}

/* ════════════════ Documents : upload (post_document) ════════════════ */
async function postDocument(body: unknown): Promise<Response> {
  if (!(body instanceof FormData)) return badRequest("FormData attendu.");
  const fileEntry = body.get("document") ?? body.get("file");
  if (!fileEntry || typeof fileEntry === "string") return badRequest("Champ « document » (fichier) manquant.");
  const file = fileEntry as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name || "document";
  const mime = file.type || mimeFromExt(path.extname(filename));

  const num = (v: FormDataEntryValue | null): number | null => {
    if (v == null || typeof v !== "string" || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  let custom_fields: ConsumeInput["custom_fields"];
  const cfRaw = body.get("custom_fields");
  if (typeof cfRaw === "string" && cfRaw) {
    try {
      custom_fields = JSON.parse(cfRaw) as ConsumeInput["custom_fields"];
    } catch {
      /* ignore */
    }
  }

  const task = await consume({
    buffer,
    filename,
    mime,
    title: (body.get("title") as string) || null,
    correspondent: num(body.get("correspondent")),
    document_type: num(body.get("document_type")),
    tags: body.getAll("tags").map((t) => Number(t)).filter((n) => Number.isFinite(n)),
    created: (body.get("created") as string) || null,
    custom_fields,
  });
  // Paperless renvoie l'UUID de tâche (chaîne JSON).
  return json(task.task_id, 200);
}

/* ════════════════ Documents : bulk_edit ════════════════ */
async function bulkEdit(body: Record<string, unknown>): Promise<Response> {
  const ids = Array.isArray(body.documents) ? (body.documents as unknown[]).map(Number).filter((n) => Number.isFinite(n)) : [];
  const method = String(body.method ?? "");
  const params = (body.parameters ?? {}) as Record<string, unknown>;
  const idSet = new Set(ids);
  const now = new Date().toISOString();
  const touched: EngineDocument[] = [];

  await mutateList<EngineDocument>(STORE.documents, (list) =>
    list.map((d) => {
      if (!idSet.has(d.id)) return d;
      let next: EngineDocument = { ...d, modified: now };
      switch (method) {
        case "set_correspondent":
          next.correspondent = toIdOrNull(params.correspondent);
          break;
        case "set_document_type":
          next.document_type = toIdOrNull(params.document_type);
          break;
        case "set_storage_path":
          next.storage_path = toIdOrNull(params.storage_path);
          break;
        case "add_tag":
          if (params.tag != null && !next.tags.includes(Number(params.tag))) next.tags = [...next.tags, Number(params.tag)];
          break;
        case "remove_tag":
          next.tags = next.tags.filter((t) => t !== Number(params.tag));
          break;
        case "modify_tags": {
          const add = Array.isArray(params.add_tags) ? (params.add_tags as unknown[]).map(Number) : [];
          const remove = Array.isArray(params.remove_tags) ? (params.remove_tags as unknown[]).map(Number) : [];
          const set = new Set(next.tags);
          add.forEach((t) => set.add(t));
          remove.forEach((t) => set.delete(t));
          next.tags = [...set];
          break;
        }
        case "delete":
          next = { ...next, deleted: true, deletedAt: now };
          break;
        default:
          break;
      }
      touched.push(next);
      return next;
    }),
  );

  const maps = await loadNameMaps();
  for (const d of touched) {
    if (d.deleted) await removeFromIndex(d.id);
    else await indexDocument(d, maps.correspondents, maps.document_types, maps.tags);
  }
  return json({ result: "OK" });
}

/* ════════════════ Documents : métadonnées / notes / suggestions ════════════ */
async function documentMetadata(id: number): Promise<Response> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  const doc = docs.find((d) => d.id === id);
  if (!doc) return notFound();
  return json({
    original_checksum: doc.checksum,
    original_size: null,
    original_mime_type: doc.mime_type,
    media_filename: doc.storedFilename,
    has_archive_version: false,
    original_metadata: [],
    archive_metadata: [],
    original_filename: doc.original_file_name,
  });
}

async function documentNotes(id: number, method: string, body: Record<string, unknown>): Promise<Response> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  const doc = docs.find((d) => d.id === id);
  if (!doc) return notFound();
  if (method === "GET") return json(doc.notes ?? []);
  if (method === "POST") {
    const note = { id: Date.now(), note: String(body.note ?? ""), created: new Date().toISOString() };
    await mutateList<EngineDocument>(STORE.documents, (list) =>
      list.map((d) => (d.id === id ? { ...d, notes: [...(d.notes ?? []), note] } : d)),
    );
    return json(doc.notes ? [...doc.notes, note] : [note]);
  }
  return json(doc.notes ?? []);
}

/* ════════════════ Taxonomies génériques ════════════════ */
type TaxoKind = "tag" | "named" | "object";
type TaxoConfig = { store: string; seq: string; kind: TaxoKind; countKey?: "correspondent" | "document_type" | "storage_path" | "tag" };
const TAXONOMIES: Record<string, TaxoConfig> = {
  tags: { store: STORE.tags, seq: "tags", kind: "tag", countKey: "tag" },
  correspondents: { store: STORE.correspondents, seq: "correspondents", kind: "named", countKey: "correspondent" },
  document_types: { store: STORE.document_types, seq: "document_types", kind: "named", countKey: "document_type" },
  storage_paths: { store: STORE.storage_paths, seq: "storage_paths", kind: "object", countKey: "storage_path" },
  custom_fields: { store: STORE.custom_fields, seq: "custom_fields", kind: "object" },
  saved_views: { store: STORE.saved_views, seq: "saved_views", kind: "object" },
  mail_accounts: { store: STORE.mail_accounts, seq: "mail_accounts", kind: "object" },
  mail_rules: { store: STORE.mail_rules, seq: "mail_rules", kind: "object" },
  groups: { store: STORE.groups, seq: "groups", kind: "object" },
};

async function withCounts(resource: string, items: EngineObject[]): Promise<EngineObject[]> {
  const cfg = TAXONOMIES[resource];
  if (!cfg?.countKey) return items;
  const counts = await loadDocCounts();
  const map = counts[cfg.countKey];
  return items.map((it) => ({ ...it, document_count: map.get(Number(it.id)) ?? 0 }));
}

async function listTaxonomy(resource: string, query: URLSearchParams): Promise<Response> {
  const cfg = TAXONOMIES[resource];
  if (!cfg) return notFound();
  let items = await readStore<EngineObject[]>(cfg.store, []);
  const ic = query.get("name__icontains");
  if (ic) items = items.filter((i) => String(i.name ?? "").toLowerCase().includes(ic.toLowerCase()));
  const iexact = query.get("name__iexact");
  if (iexact) items = items.filter((i) => String(i.name ?? "").toLowerCase() === iexact.toLowerCase());
  const id__in = parseIds(query.get("id__in"));
  if (id__in.length) items = items.filter((i) => id__in.includes(Number(i.id)));

  const withCount = await withCounts(resource, items);
  const page = Math.max(1, parseInt(query.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100000, Math.max(1, parseInt(query.get("page_size") ?? "100", 10) || 100));
  const start = (page - 1) * pageSize;
  const results = withCount.slice(start, start + pageSize);
  return json({
    count: withCount.length,
    next: start + pageSize < withCount.length ? `?page=${page + 1}&page_size=${pageSize}` : null,
    previous: page > 1 ? `?page=${page - 1}&page_size=${pageSize}` : null,
    all: withCount.map((i) => i.id),
    results,
  });
}

function buildTaxonomyRecord(resource: string, id: number, body: Record<string, unknown>): EngineObject {
  const cfg = TAXONOMIES[resource];
  const name = String(body.name ?? "");
  if (cfg.kind === "tag") {
    return {
      id,
      name,
      slug: slugify(name),
      color: typeof body.color === "string" ? body.color : randomColor(),
      text_color: typeof body.text_color === "string" ? body.text_color : "#ffffff",
      match: typeof body.match === "string" ? body.match : "",
      matching_algorithm: typeof body.matching_algorithm === "number" ? body.matching_algorithm : 0,
      is_insensitive: body.is_insensitive !== false,
      is_inbox_tag: body.is_inbox_tag === true,
      owner: null,
    };
  }
  if (cfg.kind === "named") {
    return {
      id,
      name,
      slug: slugify(name),
      match: typeof body.match === "string" ? body.match : "",
      matching_algorithm: typeof body.matching_algorithm === "number" ? body.matching_algorithm : 0,
      is_insensitive: body.is_insensitive !== false,
      owner: null,
    };
  }
  return { ...body, id };
}

async function createTaxonomy(resource: string, body: Record<string, unknown>): Promise<Response> {
  const cfg = TAXONOMIES[resource];
  if (!cfg) return notFound();
  const id = await nextId(cfg.seq);
  const record = buildTaxonomyRecord(resource, id, body);
  await mutateList<EngineObject>(cfg.store, (list) => [...list, record]);
  const [withCount] = await withCounts(resource, [record]);
  return json(withCount ?? record, 201);
}

async function getTaxonomy(resource: string, id: number): Promise<Response> {
  const cfg = TAXONOMIES[resource];
  if (!cfg) return notFound();
  const items = await readStore<EngineObject[]>(cfg.store, []);
  const item = items.find((i) => Number(i.id) === id);
  if (!item) return notFound();
  const [withCount] = await withCounts(resource, [item]);
  return json(withCount ?? item);
}

async function updateTaxonomy(resource: string, id: number, body: Record<string, unknown>): Promise<Response> {
  const cfg = TAXONOMIES[resource];
  if (!cfg) return notFound();
  let updated: EngineObject | null = null;
  await mutateList<EngineObject>(cfg.store, (list) =>
    list.map((i) => {
      if (Number(i.id) !== id) return i;
      updated = { ...i, ...body, id };
      if (typeof body.name === "string") updated.slug = slugify(body.name);
      return updated;
    }),
  );
  if (!updated) return notFound();
  const [withCount] = await withCounts(resource, [updated]);
  return json(withCount ?? updated);
}

async function deleteTaxonomy(resource: string, id: number): Promise<Response> {
  const cfg = TAXONOMIES[resource];
  if (!cfg) return notFound();
  await mutateList<EngineObject>(cfg.store, (list) => list.filter((i) => Number(i.id) !== id));
  // Nettoyage des références dans les documents (cascade douce, comme Paperless).
  if (resource === "tags" || resource === "correspondents" || resource === "document_types" || resource === "storage_paths") {
    await mutateList<EngineDocument>(STORE.documents, (list) =>
      list.map((d) => {
        if (resource === "tags" && d.tags.includes(id)) return { ...d, tags: d.tags.filter((t) => t !== id) };
        if (resource === "correspondents" && d.correspondent === id) return { ...d, correspondent: null };
        if (resource === "document_types" && d.document_type === id) return { ...d, document_type: null };
        if (resource === "storage_paths" && d.storage_path === id) return { ...d, storage_path: null };
        return d;
      }),
    );
  }
  return noContent();
}

/* ════════════════ Corbeille ════════════════ */
async function trashList(query: URLSearchParams): Promise<Response> {
  const docs = (await readStore<EngineDocument[]>(STORE.documents, [])).filter((d) => d.deleted);
  const maps = await loadNameMaps();
  const page = Math.max(1, parseInt(query.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100000, Math.max(1, parseInt(query.get("page_size") ?? "25", 10) || 25));
  const start = (page - 1) * pageSize;
  const results = docs.slice(start, start + pageSize).map((d) => ({
    ...serializeDocument(d, maps),
    deleted_at: d.deletedAt,
  }));
  return json({
    count: docs.length,
    next: start + pageSize < docs.length ? `?page=${page + 1}` : null,
    previous: page > 1 ? `?page=${page - 1}` : null,
    all: docs.map((d) => d.id),
    results,
  });
}

async function trashAction(body: Record<string, unknown>): Promise<Response> {
  const action = String(body.action ?? "");
  const ids = Array.isArray(body.documents) ? (body.documents as unknown[]).map(Number) : null;
  const match = (d: EngineDocument) => d.deleted && (!ids || ids.includes(d.id));

  if (action === "restore") {
    const restored: EngineDocument[] = [];
    await mutateList<EngineDocument>(STORE.documents, (list) =>
      list.map((d) => {
        if (!match(d)) return d;
        const r = { ...d, deleted: false, deletedAt: null };
        restored.push(r);
        return r;
      }),
    );
    const maps = await loadNameMaps();
    for (const d of restored) await indexDocument(d, maps.correspondents, maps.document_types, maps.tags);
    return json({ result: "OK" });
  }

  if (action === "empty") {
    const toPurge = (await readStore<EngineDocument[]>(STORE.documents, [])).filter(match);
    await mutateList<EngineDocument>(STORE.documents, (list) => list.filter((d) => !match(d)));
    for (const d of toPurge) {
      await deleteOriginal(d.storedFilename).catch(() => {});
      await deleteThumbnail(d.id).catch(() => {});
      await deletePreview(d.id).catch(() => {});
      await removeFromIndex(d.id);
    }
    return json({ result: "OK" });
  }
  return badRequest("Action de corbeille inconnue.");
}

/* ════════════════ Tâches ════════════════ */
async function tasksList(query: URLSearchParams): Promise<Response> {
  let tasks = await readStore<PaperlessTask[]>(STORE.tasks, []);
  const taskId = query.get("task_id");
  if (taskId) tasks = tasks.filter((t) => t.task_id === taskId);
  // La surcouche lit `.results` (cf. paperless-tasks.ts) → forme paginée.
  return json({ count: tasks.length, next: null, previous: null, all: tasks.map((t) => t.id), results: tasks });
}

/* ════════════════ Utilisateurs ════════════════ */
async function usersList(): Promise<Response> {
  const users = await listUsers();
  const results = users.map(publicUser);
  return json({ count: results.length, next: null, previous: null, all: results.map((u) => u.id), results });
}

/* ════════════════ Routeur principal ════════════════ */
export async function handle(endpoint: string, options: EngineRequestOptions = {}): Promise<Response> {
  const url = new URL(endpoint, "http://engine.local");
  const sp = options.searchParams;
  if (sp instanceof URLSearchParams) sp.forEach((v, k) => v !== "" && url.searchParams.append(k, v));
  else if (sp) for (const [k, v] of Object.entries(sp)) if (v != null && v !== "") url.searchParams.set(k, String(v));

  const query = url.searchParams;
  const method = (options.method ?? "GET").toUpperCase();
  const seg = url.pathname.split("/").filter(Boolean);
  // seg[0] === "api"
  const r = seg[1];
  const a = seg[2];
  const b = seg[3];

  try {
    // ── Documents ──
    if (r === "documents") {
      if (a === undefined) {
        if (method === "GET") return await listDocuments(query);
        return badRequest("Méthode non supportée.");
      }
      if (a === "post_document") return await postDocument(options.body);
      if (a === "bulk_edit") return await bulkEdit(readJsonBody(options.body));
      if (a === "selection_data") return json({ selected_correspondents: [], selected_tags: [], selected_document_types: [], selected_storage_paths: [] });
      const id = Number(a);
      if (!Number.isFinite(id)) return notFound();
      if (b === "thumb" || b === "preview" || b === "download") return await fileResponse(id, b);
      if (b === "metadata") return await documentMetadata(id);
      if (b === "notes") return await documentNotes(id, method, readJsonBody(options.body));
      if (b === "suggestions") return json({ correspondents: [], tags: [], document_types: [], storage_paths: [], dates: [] });
      if (b === undefined) {
        if (method === "GET") return await getDocument(id);
        if (method === "PATCH" || method === "PUT") return await patchDocument(id, readJsonBody(options.body));
        if (method === "DELETE") return await trashDocument(id);
      }
      return notFound();
    }

    // ── Taxonomies génériques ──
    if (r && TAXONOMIES[r]) {
      if (a === undefined) {
        if (method === "GET") return await listTaxonomy(r, query);
        if (method === "POST") return await createTaxonomy(r, readJsonBody(options.body));
        return badRequest("Méthode non supportée.");
      }
      const id = Number(a);
      if (!Number.isFinite(id)) return notFound();
      if (method === "GET") return await getTaxonomy(r, id);
      if (method === "PATCH" || method === "PUT") return await updateTaxonomy(r, id, readJsonBody(options.body));
      if (method === "DELETE") return await deleteTaxonomy(r, id);
      return notFound();
    }

    // ── Système ──
    if (r === "statistics") return json(await getStatistics());
    if (r === "status") return json(getSystemStatus());
    if (r === "remote_version") return json(getRemoteVersion());
    if (r === "profile") return json(await primaryProfile());
    if (r === "ui_settings") return json({ user: { id: 1, username: "admin", is_superuser: true }, settings: {}, permissions: [] });
    if (r === "tasks") return await tasksList(query);
    if (r === "acknowledge_tasks") return json({ result: "OK" });
    if (r === "logs") {
      if (a) return json([]);
      return json(["paperless", "mail"]);
    }
    if (r === "trash") {
      if (method === "POST") return await trashAction(readJsonBody(options.body));
      return await trashList(query);
    }

    // ── Utilisateurs ──
    if (r === "users") {
      if (a === undefined) {
        if (method === "GET") return await usersList();
        if (method === "POST") {
          const body = readJsonBody(options.body);
          const u = await createUser({
            username: String(body.username ?? ""),
            password: typeof body.password === "string" ? body.password : undefined,
            email: typeof body.email === "string" ? body.email : "",
            first_name: typeof body.first_name === "string" ? body.first_name : "",
            last_name: typeof body.last_name === "string" ? body.last_name : "",
            is_superuser: body.is_superuser === true,
          });
          return json(publicUser(u), 201);
        }
      } else {
        const id = Number(a);
        if (!Number.isFinite(id)) return notFound();
        if (method === "DELETE") {
          await deleteUser(id);
          return noContent();
        }
        if (method === "PATCH" || method === "PUT") {
          const body = readJsonBody(options.body);
          const u = await updateUser(id, {
            username: typeof body.username === "string" ? body.username : undefined,
            password: typeof body.password === "string" ? body.password : undefined,
            email: typeof body.email === "string" ? body.email : undefined,
            first_name: typeof body.first_name === "string" ? body.first_name : undefined,
            last_name: typeof body.last_name === "string" ? body.last_name : undefined,
            is_superuser: typeof body.is_superuser === "boolean" ? body.is_superuser : undefined,
            is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
          });
          if (!u) return notFound();
          return json(publicUser(u));
        }
      }
      return notFound();
    }

    return notFound(`Endpoint moteur non implémenté : ${url.pathname}`);
  } catch (e) {
    console.error(`[engine] erreur sur ${method} ${url.pathname} :`, e instanceof Error ? e.message : e);
    return json({ detail: e instanceof Error ? e.message : "Erreur moteur." }, 500);
  }
}
