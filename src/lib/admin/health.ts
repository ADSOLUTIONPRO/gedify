import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import {
  readStore,
  STORE,
  originalsDir,
  thumbnailsDir,
  previewsDir,
  pagesDir,
  type EngineDocument,
} from "@/lib/engine/stores";
import { getBackupsDir, legacyMediaSubdir } from "@/lib/storage/ged-paths";
import { listProjectFolders } from "@/lib/projects/project-store";
import { pgStorageActive } from "@/lib/db/pg-store";
import { jobStats } from "@/lib/jobs/job-store";
import { duplicateStats } from "@/lib/documents/duplicate-detection";

/* ────────────────────────────────────────────────────────────────────────
   Santé GED (Chantier 4) : état documentaire, stockage, base, services.
   Lecture seule, calcul à la demande. Liste les fichiers UNE fois (Sets) pour
   rester rapide même à 10 000 documents.
   ──────────────────────────────────────────────────────────────────────── */

export type DirUsage = { files: number; bytes: number };

export type GedHealth = {
  documents: {
    total: number;
    missingThumbnail: number;
    missingPreview: number;
    missingOriginal: number;
    withoutOcr: number;
    withoutFolder: number;
    aiError: number;
    jobsPending: number;
  };
  orphans: { thumbnails: number; previews: number };
  duplicates: { groups: number; exact: number; probable: number };
  storage: {
    originals: DirUsage;
    thumbnails: DirUsage;
    previews: DirUsage;
    pages: DirUsage;
    backups: DirUsage;
    totalBytes: number;
  };
  database: { mode: string; postgres: boolean; ok: boolean; detail: string | null };
  services: { openaiConfigured: boolean };
  lastBackup: { file: string; at: string } | null;
  pipeline: { pending: number; processing: number; failed: number; total: number; lastFinishedAt: string | null };
  generatedAt: string;
};

async function listNames(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

function webpId(name: string): number | null {
  const m = name.match(/^(\d+)\.webp$/);
  return m ? Number(m[1]) : null;
}

async function dirUsage(dir: string): Promise<DirUsage> {
  let files = 0;
  let bytes = 0;
  async function walk(d: string) {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        files += 1;
        try {
          bytes += (await fs.stat(full)).size;
        } catch {
          /* ignore */
        }
      }
    }
  }
  await walk(dir);
  return { files, bytes };
}

function isPending(s: EngineDocument["thumbnail_status"]): boolean {
  return s === "pending" || s === "processing";
}

async function databaseHealth(): Promise<GedHealth["database"]> {
  const mode = process.env.GEDIFY_STORAGE_MODE?.trim().toLowerCase() || "json";
  const postgres = pgStorageActive();
  if (!postgres) {
    return { mode, postgres: false, ok: true, detail: "Stockage JSON (PostgreSQL non actif)." };
  }
  try {
    const { getPool } = await import("@/lib/db/pg");
    const pool = await getPool();
    await pool.query("SELECT 1");
    return { mode, postgres: true, ok: true, detail: "Connexion PostgreSQL OK." };
  } catch (e) {
    return { mode, postgres: true, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function lastBackup(): Promise<GedHealth["lastBackup"]> {
  const dir = getBackupsDir();
  let best: { file: string; at: number } | null = null;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      try {
        const st = await fs.stat(path.join(dir, e.name));
        if (!best || st.mtimeMs > best.at) best = { file: e.name, at: st.mtimeMs };
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* dossier absent */
  }
  return best ? { file: best.file, at: new Date(best.at).toISOString() } : null;
}

export async function computeGedHealth(): Promise<GedHealth> {
  const docs = (await readStore<EngineDocument[]>(STORE.documents, [])).filter((d) => !d.deleted);
  const activeIds = new Set(docs.map((d) => d.id));

  // Inventaire disque (une lecture par dossier).
  const thumbNames = [
    ...(await listNames(thumbnailsDir())),
    ...(await listNames(legacyMediaSubdir("thumbnails"))),
  ];
  const previewNames = await listNames(previewsDir());
  const originalNames = new Set([
    ...(await listNames(originalsDir())),
    ...(await listNames(legacyMediaSubdir("originals"))),
  ]);
  const thumbIds = new Set(thumbNames.map(webpId).filter((n): n is number => n != null));
  const previewIds = new Set(previewNames.map(webpId).filter((n): n is number => n != null));

  // Documents reliés à au moins un dossier.
  const folders = await listProjectFolders().catch(() => []);
  const inFolder = new Set<number>();
  for (const f of folders) for (const id of f.linkedDocumentIds ?? []) inFolder.add(Number(id));

  let missingThumbnail = 0;
  let missingPreview = 0;
  let missingOriginal = 0;
  let withoutOcr = 0;
  let withoutFolder = 0;
  let aiError = 0;
  let jobsPending = 0;

  for (const d of docs) {
    if (!thumbIds.has(d.id)) missingThumbnail += 1;
    if (!previewIds.has(d.id)) missingPreview += 1;
    if (d.storedFilename && !originalNames.has(d.storedFilename)) missingOriginal += 1;
    if (!(d.content ?? "").trim()) withoutOcr += 1;
    if (!inFolder.has(d.id)) withoutFolder += 1;
    if (d.ai_status === "failed") aiError += 1;
    if (
      isPending(d.thumbnail_status) ||
      isPending(d.preview_status) ||
      isPending(d.ocr_status) ||
      isPending(d.ai_status) ||
      isPending(d.index_status)
    ) {
      jobsPending += 1;
    }
  }

  const orphanThumbnails = [...thumbIds].filter((id) => !activeIds.has(id)).length;
  const orphanPreviews = [...previewIds].filter((id) => !activeIds.has(id)).length;

  const [originals, thumbnails, previews, pages, backups, database, backup, jobs] = await Promise.all([
    dirUsage(originalsDir()),
    dirUsage(thumbnailsDir()),
    dirUsage(previewsDir()),
    dirUsage(pagesDir()),
    dirUsage(getBackupsDir()),
    databaseHealth(),
    lastBackup(),
    jobStats().catch(() => ({ pending: 0, processing: 0, failed: 0, total: 0, lastFinishedAt: null })),
  ]);
  const dups = await duplicateStats().catch(() => ({ groups: 0, exact: 0, probable: 0, documents: 0 }));
  // Inclure aussi l'ancienne arbo media/ dans la taille des originaux/miniatures.
  const legacyOriginals = await dirUsage(legacyMediaSubdir("originals"));
  const legacyThumbs = await dirUsage(legacyMediaSubdir("thumbnails"));
  originals.files += legacyOriginals.files;
  originals.bytes += legacyOriginals.bytes;
  thumbnails.files += legacyThumbs.files;
  thumbnails.bytes += legacyThumbs.bytes;

  const totalBytes = originals.bytes + thumbnails.bytes + previews.bytes + pages.bytes;

  return {
    documents: {
      total: docs.length,
      missingThumbnail,
      missingPreview,
      missingOriginal,
      withoutOcr,
      withoutFolder,
      aiError,
      jobsPending,
    },
    orphans: { thumbnails: orphanThumbnails, previews: orphanPreviews },
    duplicates: { groups: dups.groups, exact: dups.exact, probable: dups.probable },
    storage: { originals, thumbnails, previews, pages, backups, totalBytes },
    database,
    services: { openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()) },
    lastBackup: backup,
    pipeline: {
      pending: jobs.pending,
      processing: jobs.processing,
      failed: jobs.failed,
      total: jobs.total,
      lastFinishedAt: jobs.lastFinishedAt,
    },
    generatedAt: new Date().toISOString(),
  };
}
