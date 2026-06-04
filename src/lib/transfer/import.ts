import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { getDataDir } from "@/lib/storage/data-dir";
import {
  checksum,
  engineDir,
  mediaDir,
  originalsDir,
  readStore,
  saveOriginal,
  savePreview,
  saveThumbnail,
  slugify,
  STORE,
  thumbnailsDir,
  writeStore,
  type EngineDocument,
  type EngineNamed,
  type EngineObject,
  type EngineTag,
} from "@/lib/engine/stores";
import { mimeFromExt } from "@/lib/engine/helpers";
import { makeThumbnail } from "@/lib/engine/thumbnails";
import { makePreview } from "@/lib/engine/previews";
import { reindexAll } from "@/lib/engine/search";
import { EXPORT_FORMAT } from "./export";
import type { PaperlessDocument, PaperlessNote } from "@/lib/paperless-types";

/* ────────────────────────────────────────────────────────────────────────
   Importeur de sauvegarde Gedify → moteur local nopp.

   Reconstruit l'état complet à partir d'un .zip `gedify-export` :
     - taxonomies + documents écrits DIRECTEMENT dans les stores moteur, en
       PRÉSERVANT les IDs (clé : tous les liens .data référencent ces IDs),
     - fichiers originaux restaurés sous media/originals/<id><ext>,
     - couche surcouche (.data) restaurée telle quelle.

   Modes : « replace » (table rase puis import — défaut migration) et « merge »
   (upsert par id, dédoublonnage documents par empreinte).
   ──────────────────────────────────────────────────────────────────────── */

export type ImportMode = "replace" | "merge";

export type ImportSummary = {
  ok: true;
  mode: ImportMode;
  imported: {
    documents: number;
    files: number;
    thumbnails: number;
    correspondents: number;
    tags: number;
    document_types: number;
    storage_paths: number;
    custom_fields: number;
    saved_views: number;
    dataFiles: number;
  };
  skipped: { documentsDuplicate: number; documentsMissingFile: number };
  errors: string[];
  manifest: unknown;
};

const NOW = () => new Date().toISOString();

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function maxId(list: { id: number | string }[]): number {
  return list.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);
}

/* ── Conversions Paperless → formes internes du moteur ──────────────────── */
function toEngineTag(t: Record<string, unknown>): EngineTag {
  const name = String(t.name ?? "");
  return {
    id: Number(t.id),
    name,
    slug: typeof t.slug === "string" && t.slug ? t.slug : slugify(name),
    color: typeof t.color === "string" ? t.color : "#7C3AED",
    text_color: typeof t.text_color === "string" ? t.text_color : "#ffffff",
    match: typeof t.match === "string" ? t.match : "",
    matching_algorithm: typeof t.matching_algorithm === "number" ? t.matching_algorithm : 0,
    is_insensitive: t.is_insensitive !== false,
    is_inbox_tag: t.is_inbox_tag === true,
    owner: null,
  };
}

function toEngineNamed(n: Record<string, unknown>): EngineNamed {
  const name = String(n.name ?? "");
  return {
    id: Number(n.id),
    name,
    slug: typeof n.slug === "string" && n.slug ? n.slug : slugify(name),
    match: typeof n.match === "string" ? n.match : "",
    matching_algorithm: typeof n.matching_algorithm === "number" ? n.matching_algorithm : 0,
    is_insensitive: n.is_insensitive !== false,
    owner: null,
  };
}

function toEngineObject(o: Record<string, unknown>): EngineObject {
  const { document_count: _omit, ...rest } = o;
  void _omit;
  return { ...rest, id: Number(o.id) } as EngineObject;
}

function toAsn(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Fusionne deux listes par id (les importés écrasent les existants). */
function upsertById<T extends { id: number | string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<number, T>();
  for (const it of existing) map.set(Number(it.id), it);
  for (const it of incoming) map.set(Number(it.id), it);
  return [...map.values()];
}

/* ── Table rase (mode replace) — sans toucher users / mail / groups moteur ── */
async function wipeForReplace(): Promise<void> {
  await writeStore(STORE.documents, []);
  await writeStore(STORE.tags, []);
  await writeStore(STORE.correspondents, []);
  await writeStore(STORE.document_types, []);
  await writeStore(STORE.storage_paths, []);
  await writeStore(STORE.custom_fields, []);
  await writeStore(STORE.saved_views, []);

  // Médias : on vide originals/ et thumbnails/.
  await fs.rm(originalsDir(), { recursive: true, force: true });
  await fs.rm(thumbnailsDir(), { recursive: true, force: true });
  await ensureDir(originalsDir());
  await ensureDir(thumbnailsDir());

  // Overlay .data : tout SAUF engine/ et media/.
  const root = getDataDir();
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    entries = [];
  }
  for (const name of entries) {
    if (name === "engine" || name === "media") continue;
    await fs.rm(path.join(root, name), { recursive: true, force: true }).catch(() => {});
  }
}

/* ── Restauration de l'arbre .data depuis le zip ────────────────────────── */
async function restoreOverlay(zip: JSZip): Promise<number> {
  const root = getDataDir();
  let count = 0;
  const entries = Object.entries(zip.files).filter(
    ([name, file]) => name.startsWith("data/") && !file.dir,
  );
  for (const [name, file] of entries) {
    const rel = name.slice("data/".length);
    if (!rel) continue;
    const dest = path.join(root, rel);
    await ensureDir(path.dirname(dest));
    const buf = await file.async("nodebuffer");
    await fs.writeFile(dest, buf);
    count += 1;
  }
  return count;
}

/* ── Index des fichiers documents/files/<id>.<ext> du zip ───────────────── */
function indexDocumentFiles(zip: JSZip): Map<number, { name: string; ext: string }> {
  const map = new Map<number, { name: string; ext: string }>();
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (!name.startsWith("documents/files/")) continue;
    const base = name.slice("documents/files/".length);
    const ext = path.extname(base);
    const idStr = ext ? base.slice(0, -ext.length) : base;
    const id = Number(idStr);
    if (Number.isFinite(id)) map.set(id, { name, ext: ext.toLowerCase() });
  }
  return map;
}

async function readZipJson<T>(zip: JSZip, name: string): Promise<T | null> {
  const file = zip.file(name);
  if (!file) return null;
  try {
    return JSON.parse(await file.async("string")) as T;
  } catch {
    return null;
  }
}

/* ── Point d'entrée ─────────────────────────────────────────────────────── */
export async function importFromZip(
  buffer: Buffer,
  options: { mode?: ImportMode } = {},
): Promise<ImportSummary> {
  const mode: ImportMode = options.mode ?? "replace";
  const errors: string[] = [];

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    throw new Error(`Archive illisible : ${e instanceof Error ? e.message : e}`);
  }

  const manifest = await readZipJson<{ format?: string; version?: number }>(zip, "manifest.json");
  if (!manifest || manifest.format !== EXPORT_FORMAT) {
    throw new Error("Archive non reconnue (manifest.json manquant ou format invalide).");
  }

  await ensureDir(engineDir());
  await ensureDir(mediaDir());

  if (mode === "replace") await wipeForReplace();

  // 1) Taxonomies
  const tagsIn = ((await readZipJson<Record<string, unknown>[]>(zip, "taxonomies/tags.json")) ?? []).map(toEngineTag);
  const corrIn = ((await readZipJson<Record<string, unknown>[]>(zip, "taxonomies/correspondents.json")) ?? []).map(toEngineNamed);
  const typeIn = ((await readZipJson<Record<string, unknown>[]>(zip, "taxonomies/document_types.json")) ?? []).map(toEngineNamed);
  const spIn = ((await readZipJson<Record<string, unknown>[]>(zip, "taxonomies/storage_paths.json")) ?? []).map(toEngineObject);
  const cfIn = ((await readZipJson<Record<string, unknown>[]>(zip, "taxonomies/custom_fields.json")) ?? []).map(toEngineObject);
  const svIn = ((await readZipJson<Record<string, unknown>[]>(zip, "taxonomies/saved_views.json")) ?? []).map(toEngineObject);

  const tags = mode === "merge" ? upsertById(await readStore<EngineTag[]>(STORE.tags, []), tagsIn) : tagsIn;
  const correspondents = mode === "merge" ? upsertById(await readStore<EngineNamed[]>(STORE.correspondents, []), corrIn) : corrIn;
  const documentTypes = mode === "merge" ? upsertById(await readStore<EngineNamed[]>(STORE.document_types, []), typeIn) : typeIn;
  const storagePaths = mode === "merge" ? upsertById(await readStore<EngineObject[]>(STORE.storage_paths, []), spIn) : spIn;
  const customFields = mode === "merge" ? upsertById(await readStore<EngineObject[]>(STORE.custom_fields, []), cfIn) : cfIn;
  const savedViews = mode === "merge" ? upsertById(await readStore<EngineObject[]>(STORE.saved_views, []), svIn) : svIn;

  await writeStore(STORE.tags, tags);
  await writeStore(STORE.correspondents, correspondents);
  await writeStore(STORE.document_types, documentTypes);
  await writeStore(STORE.storage_paths, storagePaths);
  await writeStore(STORE.custom_fields, customFields);
  await writeStore(STORE.saved_views, savedViews);

  // 2) Documents (+ fichiers + miniatures)
  const docsIn = (await readZipJson<PaperlessDocument[]>(zip, "documents/index.json")) ?? [];
  const fileIndex = indexDocumentFiles(zip);

  const existingDocs = mode === "merge" ? await readStore<EngineDocument[]>(STORE.documents, []) : [];
  const byId = new Map<number, EngineDocument>(existingDocs.map((d) => [d.id, d]));
  const existingChecksums = new Map<string, number>();
  for (const d of existingDocs) if (d.checksum) existingChecksums.set(d.checksum, d.id);

  let files = 0;
  let thumbnails = 0;
  let dupCount = 0;
  let missingFile = 0;

  for (const doc of docsIn) {
    const id = Number(doc.id);
    if (!Number.isFinite(id)) continue;

    let storedFilename = "";
    let sum = "";
    const fileEntry = fileIndex.get(id);
    let buf: Buffer | null = null;
    let ext = "";

    if (fileEntry) {
      try {
        buf = await zip.file(fileEntry.name)!.async("nodebuffer");
        ext = fileEntry.ext;
        sum = checksum(buf);
      } catch (e) {
        errors.push(`Document #${id} : lecture du fichier impossible (${e instanceof Error ? e.message : e})`);
      }
    }

    // Dédoublonnage (merge) : même empreinte sur un AUTRE id → on saute.
    if (mode === "merge" && sum) {
      const owner = existingChecksums.get(sum);
      if (owner != null && owner !== id) {
        dupCount += 1;
        continue;
      }
    }

    const mime = doc.mime_type ?? (ext ? mimeFromExt(ext) : null);

    let thumbnailStatus: EngineDocument["thumbnail_status"] = buf ? "failed" : "pending";
    let previewStatus: EngineDocument["preview_status"] = buf ? "failed" : "pending";
    if (buf) {
      storedFilename = await saveOriginal(id, ext, buf);
      files += 1;
      if (sum) existingChecksums.set(sum, id);
      try {
        const thumb = await makeThumbnail(buf, mime ?? "", ext);
        await saveThumbnail(id, thumb);
        thumbnails += 1;
        thumbnailStatus = "ready";
      } catch {
        /* miniature best-effort (générée à la volée sinon) */
      }
      try {
        const preview = await makePreview(buf, mime ?? "", ext);
        if (preview) {
          await savePreview(id, preview);
          previewStatus = "ready";
        } else {
          previewStatus = "skipped";
        }
      } catch {
        /* aperçu best-effort */
      }
    } else {
      missingFile += 1;
    }

    const createdIso = doc.created ?? doc.created_date ?? NOW();
    const cf = (doc as Record<string, unknown>).custom_fields;
    const engineDoc: EngineDocument = {
      id,
      title: doc.title ?? `Document ${id}`,
      content: doc.content ?? "",
      created: createdIso,
      created_date: doc.created_date ?? String(createdIso).slice(0, 10),
      added: doc.added ?? NOW(),
      modified: doc.modified ?? NOW(),
      correspondent: doc.correspondent ?? null,
      document_type: doc.document_type ?? null,
      storage_path: doc.storage_path ?? null,
      tags: Array.isArray(doc.tags) ? doc.tags.map(Number).filter((n) => Number.isFinite(n)) : [],
      archive_serial_number: toAsn(doc.archive_serial_number),
      original_file_name: doc.original_file_name ?? null,
      mime_type: mime,
      page_count: doc.page_count ?? null,
      notes: Array.isArray(doc.notes) ? (doc.notes as PaperlessNote[]) : [],
      owner: doc.owner ?? 1,
      custom_fields: Array.isArray(cf) ? (cf as EngineDocument["custom_fields"]) : [],
      storedFilename,
      checksum: sum,
      deleted: false,
      deletedAt: null,
      thumbnail_status: thumbnailStatus,
      preview_status: previewStatus,
      pages_status: "pending",
      ocr_status: (doc.content ?? "").trim() ? "ready" : "skipped",
      ai_status: "pending",
      index_status: "pending",
    };
    byId.set(id, engineDoc);
  }

  const documents = [...byId.values()].sort((a, b) => b.id - a.id);
  await writeStore(STORE.documents, documents);

  // 3) Compteurs d'IDs (évite toute collision sur les créations futures)
  const counters = await readStore<Record<string, number>>("counters", {});
  counters.documents = Math.max(counters.documents ?? 0, maxId(documents));
  counters.tags = Math.max(counters.tags ?? 0, maxId(tags));
  counters.correspondents = Math.max(counters.correspondents ?? 0, maxId(correspondents));
  counters.document_types = Math.max(counters.document_types ?? 0, maxId(documentTypes));
  counters.storage_paths = Math.max(counters.storage_paths ?? 0, maxId(storagePaths));
  counters.custom_fields = Math.max(counters.custom_fields ?? 0, maxId(customFields));
  counters.saved_views = Math.max(counters.saved_views ?? 0, maxId(savedViews));
  await writeStore("counters", counters);

  // 4) Couche surcouche (.data)
  const dataFiles = await restoreOverlay(zip);

  // 5) Réindexation plein-texte
  let indexStatus: EngineDocument["index_status"] = "ready";
  try {
    await reindexAll();
  } catch (e) {
    indexStatus = "failed";
    errors.push(`Réindexation : ${e instanceof Error ? e.message : e}`);
  }
  // Refléter le résultat de l'indexation sur les documents importés.
  if (documents.some((d) => d.index_status !== indexStatus)) {
    await writeStore(
      STORE.documents,
      documents.map((d) => ({ ...d, index_status: indexStatus })),
    );
  }

  return {
    ok: true,
    mode,
    imported: {
      documents: documents.length,
      files,
      thumbnails,
      correspondents: correspondents.length,
      tags: tags.length,
      document_types: documentTypes.length,
      storage_paths: storagePaths.length,
      custom_fields: customFields.length,
      saved_views: savedViews.length,
      dataFiles,
    },
    skipped: { documentsDuplicate: dupCount, documentsMissingFile: missingFile },
    errors,
    manifest,
  };
}
