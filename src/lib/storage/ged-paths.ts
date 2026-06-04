import "server-only";

import fs from "node:fs";
import path from "node:path";
import { getDataDir } from "./data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Arborescence de stockage FICHIERS de la GED autonome (Chantier 2).

   Les fichiers binaires (PDF, images, dérivés) vivent sur le DISQUE, sous
   FILES_DIR. PostgreSQL/JSON ne stockent que les MÉTADONNÉES + chemins relatifs.
   Règles : on ne supprime ni n'écrase jamais un original ; les répertoires sont
   créés de façon idempotente ; rien n'est exposé publiquement.

   Cible :
     <FILES_DIR>/
       ├── originals/   (fichiers importés, source de vérité — jamais modifiés)
       ├── archives/    (PDF archivés / normalisés)
       ├── thumbnails/  (miniatures légères .webp)
       ├── previews/    (aperçus moyenne résolution)
       ├── pages/       (pages PDF rendues)
       ├── signed/      (versions signées, distinctes des originaux)
       ├── trash/       (corbeille fichiers avant suppression définitive)
       └── tmp/         (fichiers temporaires de traitement)
     <DATA_DIR>/ocr      <DATA_DIR>/ai       <DATA_DIR>/cache
     <DATA_DIR>/logs     <BACKUPS_DIR>

   Compat héritée : avant ce chantier, originaux/miniatures vivaient sous
   <DATA_DIR>/media/{originals,thumbnails}. Les lectures replient sur cet ancien
   emplacement pour ne JAMAIS perdre un fichier déjà importé.
   ──────────────────────────────────────────────────────────────────────── */

function envDir(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

/** Racine des FICHIERS (originaux + dérivés). FILES_DIR ?? <DATA_DIR>/files. */
export function getFilesDir(): string {
  return envDir("FILES_DIR") ?? path.join(getDataDir(), "files");
}

export const FILE_CATEGORIES = [
  "originals",
  "archives",
  "thumbnails",
  "previews",
  "pages",
  "signed",
  "trash",
  "tmp",
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

/** Sous-répertoire d'une catégorie de fichiers (sous FILES_DIR). */
export function filesSubdir(category: FileCategory): string {
  return path.join(getFilesDir(), category);
}

/* Répertoires de données annexes (hors binaires document). */
export function getOcrDir(): string {
  return path.join(getDataDir(), "ocr");
}
export function getAiDir(): string {
  return path.join(getDataDir(), "ai");
}
export function getCacheDir(): string {
  return path.join(getDataDir(), "cache");
}
export function getLogsDir(): string {
  return path.join(getDataDir(), "logs");
}
export function getBackupsDir(): string {
  return envDir("BACKUPS_DIR") ?? path.join(getDataDir(), "backups");
}

/** Liste de TOUS les répertoires standard à garantir. */
export function gedStorageDirs(): string[] {
  return [
    getFilesDir(),
    ...FILE_CATEGORIES.map(filesSubdir),
    getOcrDir(),
    getAiDir(),
    getCacheDir(),
    getLogsDir(),
    getBackupsDir(),
  ];
}

let ensured = false;

/**
 * Crée (idempotent) toute l'arborescence GED. Sûr : `mkdir -p` uniquement, ne
 * touche AUCUN fichier existant. Appelé une fois au démarrage et par l'outil de
 * diagnostic.
 */
export function ensureGedStorage(): void {
  if (ensured) return;
  ensured = true;
  for (const dir of gedStorageDirs()) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      /* best-effort : un volume non inscriptible est déjà signalé par data-dir */
    }
  }
}

/* ── Compat héritée : <DATA_DIR>/media/{originals,thumbnails} ─────────────── */
export function legacyMediaSubdir(category: "originals" | "thumbnails"): string {
  return path.join(getDataDir(), "media", category);
}

/**
 * Résout le chemin EXISTANT d'un fichier : nouvelle arbo `files/<cat>/` en
 * priorité, repli sur l'ancienne `media/<cat>/`. Renvoie null si introuvable
 * partout. Garantit qu'un original importé avant ce chantier reste lisible.
 */
export function resolveExistingFilePath(category: FileCategory, filename: string): string | null {
  const candidates = [path.join(filesSubdir(category), filename)];
  if (category === "originals" || category === "thumbnails") {
    candidates.push(path.join(legacyMediaSubdir(category), filename));
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return null;
}
