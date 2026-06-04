import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { getDataDir } from "@/lib/storage/data-dir";
import { paperlessFetch, paperlessFetchRaw } from "@/lib/paperless";
import { pgStorageActive } from "@/lib/db/pg-store";
import { dumpPostgres } from "@/lib/transfer/pg-backup";
import type { PaperlessDocument, PaperlessListResponse } from "@/lib/paperless-types";

/* ────────────────────────────────────────────────────────────────────────
   Collecteur d'export universel Gedify (« sauvegarde / migration »).

   Produit un .zip autoportant contenant TOUTES les données :
     - documents (métadonnées + fichiers originaux),
     - taxonomies (tags, correspondants, types, chemins, champs perso, vues),
     - couche surcouche (.data : analyses OCR/IA, dossiers, finances, actions,
       writer, liens mail↔doc, réglages mails…).

   Ce fichier est IDENTIQUE entre l'ancienne surcouche (adossée à Paperless) et
   l'app autonome nopp : les deux exposent la même API `@/lib/paperless`. Seules
   les constantes APP_NAME / SOURCE_KIND diffèrent d'une copie à l'autre.
   Cf. [[data-persistence-convention]] et [[nopp-autonomous-engine-2026-06]].
   ──────────────────────────────────────────────────────────────────────── */

export const EXPORT_FORMAT = "gedify-export";
export const EXPORT_VERSION = 1;

/** Identité de l'app source (diffère dans la copie ancienne surcouche). */
const APP_NAME = "gedify-nopp";
const SOURCE_KIND: "paperless" | "engine" = "engine";

export type ExportOptions = {
  /** Inclure les fichiers originaux (volumineux). Par défaut true. */
  includeFiles?: boolean;
};

export type ExportCounts = {
  documents: number;
  files: number;
  correspondents: number;
  tags: number;
  document_types: number;
  storage_paths: number;
  custom_fields: number;
  saved_views: number;
  dataFiles: number;
  /** Lignes dumpées par table PostgreSQL (mode postgres uniquement). */
  postgres?: Record<string, number>;
};

export type ExportResult = {
  buffer: Buffer;
  filename: string;
  counts: ExportCounts;
  errors: string[];
};

/* ── Répertoires .data exclus de la copie « overlay » ───────────────────────
   engine/, media/ (héritée) et files/ (binaires) sont reconstruits depuis
   documents/ + taxonomies/ ; on ne les duplique donc pas dans l'overlay. Les
   originaux partent via documents/files/. .DS_Store est du bruit macOS. */
const OVERLAY_EXCLUDED_DIRS = new Set(["engine", "media", "files"]);
const NOISE_FILES = new Set([".DS_Store", ".write-test"]);

/* ── Fichiers mail-connector porteurs de secrets (exclus / expurgés) ──────── */
const SECRET_FILE = "mail-connector/gmail-tokens.json";

/* ── Pagination générique d'une liste « Paperless-compatible » ───────────── */
async function fetchAll<T>(endpoint: string): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const res = await paperlessFetch<PaperlessListResponse<T>>(endpoint, {
      searchParams: { page, page_size: 100 },
    });
    if (!res || !Array.isArray(res.results)) break;
    out.push(...res.results);
    if (!res.next || res.results.length === 0) break;
    page += 1;
    if (page > 100000) break; // garde-fou
  }
  return out;
}

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/tiff": ".tif",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "text/html": ".html",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

function fileExtFor(doc: PaperlessDocument): string {
  const fromName = doc.original_file_name ? path.extname(doc.original_file_name) : "";
  if (fromName) return fromName.toLowerCase();
  return EXT_BY_MIME[doc.mime_type ?? ""] ?? "";
}

/* ── Sérialisation taxonomie : on retire document_count (recalculé à l'import) */
function stripCount<T extends Record<string, unknown>>(items: T[]): T[] {
  return items.map((it) => {
    const { document_count: _omit, ...rest } = it as Record<string, unknown>;
    void _omit;
    return rest as T;
  });
}

/* ── Copie récursive de l'arbre .data dans le zip (secrets expurgés) ──────── */
async function addOverlayTree(zip: JSZip, root: string): Promise<number> {
  let count = 0;
  async function walk(absDir: string, relDir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!relDir && OVERLAY_EXCLUDED_DIRS.has(entry.name)) continue;
        await walk(path.join(absDir, entry.name), rel);
        continue;
      }
      if (NOISE_FILES.has(entry.name)) continue;
      if (rel === SECRET_FILE) continue; // tokens OAuth : jamais exportés
      const abs = path.join(absDir, entry.name);
      let buf: Buffer;
      try {
        buf = await fs.readFile(abs);
      } catch {
        continue;
      }
      if (rel === "mail-connector/accounts.json") {
        buf = redactAccounts(buf);
      }
      zip.file(`data/${rel}`, buf);
      count += 1;
    }
  }
  await walk(root, "");
  return count;
}

/** Retire les identifiants stockés des comptes mail (mots de passe chiffrés). */
function redactAccounts(buf: Buffer): Buffer {
  try {
    const arr = JSON.parse(buf.toString("utf8")) as Record<string, unknown>[];
    if (!Array.isArray(arr)) return buf;
    for (const acc of arr) {
      acc.encryptedPassword = null;
      acc.hasPassword = false;
    }
    return Buffer.from(JSON.stringify(arr, null, 2), "utf8");
  } catch {
    return buf;
  }
}

/* ── Point d'entrée : construit le .zip complet ─────────────────────────── */
export async function buildExportZip(options: ExportOptions = {}): Promise<ExportResult> {
  const includeFiles = options.includeFiles !== false;
  const errors: string[] = [];
  const zip = new JSZip();

  // 1) Documents (métadonnées)
  const documents = await fetchAll<PaperlessDocument>("/api/documents/");
  zip.file("documents/index.json", JSON.stringify(documents, null, 2));

  // 2) Documents (fichiers originaux)
  let files = 0;
  if (includeFiles) {
    for (const doc of documents) {
      try {
        const res = await paperlessFetchRaw(`/api/documents/${doc.id}/download/`, {
          searchParams: { original: "true" },
        });
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = fileExtFor(doc);
        zip.file(`documents/files/${doc.id}${ext}`, buf);
        files += 1;
      } catch (e) {
        errors.push(`Document #${doc.id} : fichier non exporté (${e instanceof Error ? e.message : e})`);
      }
    }
  }

  // 3) Taxonomies
  const correspondents = stripCount(await fetchAll<Record<string, unknown>>("/api/correspondents/"));
  const tags = stripCount(await fetchAll<Record<string, unknown>>("/api/tags/"));
  const document_types = stripCount(await fetchAll<Record<string, unknown>>("/api/document_types/"));
  const storage_paths = stripCount(await fetchAll<Record<string, unknown>>("/api/storage_paths/").catch(() => []));
  const custom_fields = stripCount(await fetchAll<Record<string, unknown>>("/api/custom_fields/").catch(() => []));
  const saved_views = stripCount(await fetchAll<Record<string, unknown>>("/api/saved_views/").catch(() => []));
  zip.file("taxonomies/correspondents.json", JSON.stringify(correspondents, null, 2));
  zip.file("taxonomies/tags.json", JSON.stringify(tags, null, 2));
  zip.file("taxonomies/document_types.json", JSON.stringify(document_types, null, 2));
  zip.file("taxonomies/storage_paths.json", JSON.stringify(storage_paths, null, 2));
  zip.file("taxonomies/custom_fields.json", JSON.stringify(custom_fields, null, 2));
  zip.file("taxonomies/saved_views.json", JSON.stringify(saved_views, null, 2));

  // 4) Couche surcouche (.data)
  const dataFiles = await addOverlayTree(zip, getDataDir());

  // 4 bis) Dump logique PostgreSQL (mode postgres) — source de vérité des
  // domaines en base, là où l'overlay JSON n'est plus à jour.
  let postgres: Record<string, number> | undefined;
  if (pgStorageActive()) {
    try {
      const dump = await dumpPostgres();
      zip.file("postgres/dump.json", JSON.stringify(dump));
      postgres = dump.counts;
    } catch (e) {
      errors.push(`Dump PostgreSQL : ${e instanceof Error ? e.message : e}`);
    }
  }

  // 5) Manifeste
  const counts: ExportCounts = {
    documents: documents.length,
    files,
    correspondents: correspondents.length,
    tags: tags.length,
    document_types: document_types.length,
    storage_paths: storage_paths.length,
    custom_fields: custom_fields.length,
    saved_views: saved_views.length,
    dataFiles,
    ...(postgres ? { postgres } : {}),
  };
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        app: APP_NAME,
        sourceKind: SOURCE_KIND,
        exportedAt: new Date().toISOString(),
        includeFiles,
        secretsRedacted: true,
        counts,
      },
      null,
      2,
    ),
  );

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13); // YYYYMMDDHHmm
  return { buffer, filename: `gedify-export-${stamp}.zip`, counts, errors };
}
