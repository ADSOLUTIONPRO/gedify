import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getDataDir } from "@/lib/storage/data-dir";
import { filesSubdir, legacyMediaSubdir, resolveExistingFilePath } from "@/lib/storage/ged-paths";
import {
  postgresEngineEnabled,
  engineCollectionSupported,
  engineSettingSupported,
  jsonFallbackEnabled,
  readCollectionPg,
  writeCollectionPg,
  readSettingPg,
  writeSettingPg,
  nextIdPg,
} from "@/lib/db/engine-pg";
import type { PaperlessNote } from "@/lib/paperless-types";

/* ────────────────────────────────────────────────────────────────────────
   Moteur documentaire local (remplace Paperless) — couche stockage.
   Tous les états vivent sous getDataDir() : stores JSON dans engine/, et
   fichiers (originaux + miniatures) sous media/. Cf. [[data-persistence-convention]].
   ──────────────────────────────────────────────────────────────────────── */

export function engineDir() {
  return path.join(getDataDir(), "engine");
}
/** Ancienne arbo des binaires (avant le chantier stockage). Conservée pour le
 *  repli en lecture et le nettoyage ; plus aucune écriture neuve n'y va. */
export function mediaDir() {
  return path.join(getDataDir(), "media");
}
/* Binaires sous la nouvelle arbo files/ (cf. ged-paths). Les écritures neuves
   vont ici ; les lectures replient sur l'ancienne media/ (resolveExistingFilePath). */
export function originalsDir() {
  return filesSubdir("originals");
}
export function thumbnailsDir() {
  return filesSubdir("thumbnails");
}
export function previewsDir() {
  return filesSubdir("previews");
}
export function pagesDir() {
  return filesSubdir("pages");
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/* ── Verrou async par fichier (sérialise les écritures concurrentes) ────── */
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function storePath(name: string) {
  return path.join(engineDir(), `${name}.json`);
}

async function writeJsonAtomic(file: string, data: unknown) {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/** Lecture JSON brute (interne — chemin par défaut, inchangé). */
async function readStoreJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(storePath(name), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Lecture d'un store. En mode `postgres` et pour une collection moteur prise en
 * charge (documents, tags, types, correspondants, custom_fields, counters), lit
 * depuis Postgres en préservant la forme JSON ; sinon (ou si repli activé en cas
 * d'erreur) lit le JSON. Comportement par défaut (mode json) : identique à avant.
 */
export async function readStore<T>(name: string, fallback: T): Promise<T> {
  if (postgresEngineEnabled()) {
    if (engineSettingSupported(name)) {
      try {
        const v = await readSettingPg(name);
        return (v ?? fallback) as T;
      } catch (e) {
        if (jsonFallbackEnabled()) return readStoreJson(name, fallback);
        throw e;
      }
    }
    if (engineCollectionSupported(name)) {
      try {
        return (await readCollectionPg(name)) as T;
      } catch (e) {
        if (jsonFallbackEnabled()) return readStoreJson(name, fallback);
        throw e;
      }
    }
  }
  return readStoreJson(name, fallback);
}

/** Écriture atomique d'un store (Postgres en mode postgres, sinon JSON). */
export async function writeStore<T>(name: string, data: T): Promise<void> {
  if (postgresEngineEnabled()) {
    if (engineSettingSupported(name)) {
      await writeSettingPg(name, data);
      return;
    }
    if (engineCollectionSupported(name)) {
      await writeCollectionPg(name, data);
      return;
    }
  }
  await withLock(`store:${name}`, () => writeJsonAtomic(storePath(name), data));
}

/**
 * Mise à jour atomique « read-modify-write » d'un store-liste, sous verrou,
 * pour éviter les pertes lors d'écritures concurrentes (création/patch/suppr.).
 */
export async function mutateList<T>(name: string, mutate: (list: T[]) => T[] | Promise<T[]>): Promise<T[]> {
  if (postgresEngineEnabled() && engineCollectionSupported(name)) {
    return withLock(`pg:${name}`, async () => {
      const current = (await readCollectionPg(name)) as T[];
      const updated = await mutate(current);
      await writeCollectionPg(name, updated);
      return updated;
    });
  }
  return withLock(`store:${name}`, async () => {
    const current = await readStoreJson<T[]>(name, []);
    const updated = await mutate(current);
    await writeJsonAtomic(storePath(name), updated);
    return updated;
  });
}

/* ── Compteurs d'identifiants (entiers auto-incrémentés façon Paperless) ── */
type Counters = Record<string, number>;

async function nextIdJson(seq: string): Promise<number> {
  return withLock("counters", async () => {
    const counters = await readStoreJson<Counters>("counters", {});
    const id = (counters[seq] ?? 0) + 1;
    counters[seq] = id;
    await writeJsonAtomic(storePath("counters"), counters);
    return id;
  });
}

export async function nextId(seq: string): Promise<number> {
  if (postgresEngineEnabled()) {
    try {
      return await nextIdPg(seq);
    } catch (e) {
      if (jsonFallbackEnabled()) return nextIdJson(seq);
      throw e;
    }
  }
  return nextIdJson(seq);
}

/* ── Médias (fichiers originaux + miniatures) ───────────────────────────── */
export function checksum(buf: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function saveOriginal(id: number, ext: string, buf: Buffer): Promise<string> {
  await ensureDir(originalsDir());
  const safeExt = ext && /^\.[A-Za-z0-9]+$/.test(ext) ? ext.toLowerCase() : "";
  const filename = `${id}${safeExt}`;
  await fs.writeFile(path.join(originalsDir(), filename), buf);
  return filename;
}

export async function readOriginal(filename: string): Promise<Buffer | null> {
  // Nouvelle arbo files/ en priorité, repli sur l'ancienne media/.
  const p = resolveExistingFilePath("originals", filename);
  if (!p) return null;
  try {
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

export async function deleteOriginal(filename: string): Promise<void> {
  await fs.rm(path.join(originalsDir(), filename), { force: true });
  await fs.rm(path.join(legacyMediaSubdir("originals"), filename), { force: true });
}

export async function saveThumbnail(id: number, buf: Buffer): Promise<void> {
  await ensureDir(thumbnailsDir());
  await fs.writeFile(path.join(thumbnailsDir(), `${id}.webp`), buf);
}

export async function readThumbnail(id: number): Promise<Buffer | null> {
  const p = resolveExistingFilePath("thumbnails", `${id}.webp`);
  if (!p) return null;
  try {
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

export async function deleteThumbnail(id: number): Promise<void> {
  await fs.rm(path.join(thumbnailsDir(), `${id}.webp`), { force: true });
  await fs.rm(path.join(legacyMediaSubdir("thumbnails"), `${id}.webp`), { force: true });
}

/** Présence d'une miniature sur disque (nouvelle arbo files/ ou héritée media/). */
export async function thumbnailExists(id: number): Promise<boolean> {
  return resolveExistingFilePath("thumbnails", `${id}.webp`) != null;
}

/** Présence du fichier original sur disque (nouvelle arbo files/ ou héritée). */
export async function originalExists(filename: string): Promise<boolean> {
  if (!filename) return false;
  return resolveExistingFilePath("originals", filename) != null;
}

/* ── Aperçus (previews) — image moyenne résolution, files/previews/<id>.webp ── */
export async function savePreview(id: number, buf: Buffer): Promise<void> {
  await ensureDir(previewsDir());
  await fs.writeFile(path.join(previewsDir(), `${id}.webp`), buf);
}
export async function readPreview(id: number): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(previewsDir(), `${id}.webp`));
  } catch {
    return null;
  }
}
export async function deletePreview(id: number): Promise<void> {
  await fs.rm(path.join(previewsDir(), `${id}.webp`), { force: true });
}
export async function previewExists(id: number): Promise<boolean> {
  try {
    await fs.stat(path.join(previewsDir(), `${id}.webp`));
    return true;
  } catch {
    return false;
  }
}

/* ── Pages PDF rendues — files/pages/<id>/<n>.webp ─────────────────────────── */
function pageDirFor(id: number) {
  return path.join(pagesDir(), String(id));
}
export async function savePage(id: number, pageNumber: number, buf: Buffer): Promise<void> {
  await ensureDir(pageDirFor(id));
  await fs.writeFile(path.join(pageDirFor(id), `${pageNumber}.webp`), buf);
}
export async function readPage(id: number, pageNumber: number): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(pageDirFor(id), `${pageNumber}.webp`));
  } catch {
    return null;
  }
}
export async function deletePages(id: number): Promise<void> {
  await fs.rm(pageDirFor(id), { recursive: true, force: true });
}

/* ── Statuts de traitement par étape du pipeline documentaire ──────────────
   pending : à faire · processing : en cours · ready : prêt · failed : échec ·
   skipped : non applicable (ex. pas d'OCR pour un .txt). Champs OPTIONNELS :
   les documents importés avant ce chantier n'en ont pas (traités comme inconnus
   → la page Santé peut recalculer depuis le disque). */
export type DerivedStatus = "pending" | "processing" | "ready" | "failed" | "skipped";

export type DocumentDerivedStatuses = {
  import_status?: DerivedStatus;
  thumbnail_status?: DerivedStatus;
  preview_status?: DerivedStatus;
  pages_status?: DerivedStatus;
  ocr_status?: DerivedStatus;
  index_status?: DerivedStatus;
  ai_status?: DerivedStatus;
  classification_status?: DerivedStatus; // ready = classé ; pending = à classer
  archive_status?: DerivedStatus;
  /** Horodatage du dernier traitement pipeline + dernière erreur (debug). */
  last_processed_at?: string | null;
  last_error?: string | null;
  /** Scores de confiance (0–100) quand disponibles. */
  ocr_confidence?: number | null;
  ai_confidence?: number | null;
  classification_confidence?: number | null;
  needs_review_reason?: string | null;
  /** Détails OCR (industrialisation Partie 4). */
  ocr_source?: "native_pdf_text" | "ocr_engine" | "text_file" | "unavailable" | null;
  ocr_engine?: string | null;
  ocr_language?: string | null;
  ocr_text_length?: number | null;
  ocr_pages_count?: number | null;
  ocr_quality?: "good" | "low" | null;
  ocr_started_at?: string | null;
  ocr_finished_at?: string | null;
  ocr_attempts?: number | null;
};

/* ── Modèle interne d'un document (sur-ensemble de PaperlessDocument) ────── */
export type EngineDocument = DocumentDerivedStatuses & {
  id: number;
  title: string;
  content: string;
  created: string; // ISO 8601
  created_date: string; // YYYY-MM-DD
  added: string; // ISO 8601
  modified: string; // ISO 8601
  correspondent: number | null;
  document_type: number | null;
  storage_path: number | null;
  tags: number[];
  archive_serial_number: number | null;
  original_file_name: string | null;
  mime_type: string | null;
  page_count: number | null;
  notes: PaperlessNote[];
  owner: number | null;
  custom_fields: { field: number; value: unknown }[];
  // ── champs internes (non exposés tels quels) ──
  storedFilename: string;
  checksum: string;
  deleted: boolean;
  deletedAt: string | null;
};

/* ── Taxonomies (formes proches de Paperless, document_count calculé) ───── */
export type EngineTag = {
  id: number;
  name: string;
  slug: string;
  color: string;
  text_color: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  is_inbox_tag: boolean;
  owner: number | null;
};
export type EngineNamed = {
  id: number;
  name: string;
  slug: string;
  match: string;
  matching_algorithm: number;
  is_insensitive: boolean;
  owner: number | null;
};

/** Objet générique avec id (custom_fields, storage_paths, saved_views, mail…). */
export type EngineObject = { id: number; [key: string]: unknown };

export type EngineUser = {
  id: number;
  username: string;
  passwordHash: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  is_staff: boolean;
  is_active: boolean;
  /** Rôle applicatif (permissions). Optionnel : déduit de is_superuser/is_staff si absent. */
  role?: "admin" | "manager" | "editor" | "viewer";
};

/* ── Noms des stores (clés de fichiers JSON sous engine/) ───────────────── */
export const STORE = {
  documents: "documents",
  tags: "tags",
  correspondents: "correspondents",
  document_types: "document_types",
  custom_fields: "custom_fields",
  storage_paths: "storage_paths",
  saved_views: "saved_views",
  mail_accounts: "mail_accounts",
  mail_rules: "mail_rules",
  tasks: "tasks",
  users: "users",
  groups: "groups",
} as const;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 128);
}
