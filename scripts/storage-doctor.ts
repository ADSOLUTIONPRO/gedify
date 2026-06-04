/* gedify:storage:doctor — Chantier 2 : socle de stockage fichiers.

   1. CRÉE (idempotent) l'arborescence GED standard sous FILES_DIR + DATA_DIR.
   2. VÉRIFIE que chaque original référencé par la GED est bien présent sur le
      disque (nouvelle arbo `files/originals` OU ancienne `media/originals`).
   3. Signale les documents sans miniature et les éventuels originaux manquants.

   N'écrit AUCUN fichier document, ne déplace rien, ne supprime rien.
   Sûr et relançable. */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./_shared";

const FILE_CATEGORIES = [
  "originals",
  "archives",
  "thumbnails",
  "previews",
  "pages",
  "signed",
  "trash",
  "tmp",
] as const;

function envDir(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

function filesDir(root: string): string {
  return envDir("FILES_DIR") ?? path.join(root, "files");
}
function backupsDir(root: string): string {
  return envDir("BACKUPS_DIR") ?? path.join(root, "backups");
}

/** Tous les répertoires standard à garantir. */
function standardDirs(root: string): string[] {
  const f = filesDir(root);
  return [
    f,
    ...FILE_CATEGORIES.map((c) => path.join(f, c)),
    path.join(root, "ocr"),
    path.join(root, "ai"),
    path.join(root, "cache"),
    path.join(root, "logs"),
    backupsDir(root),
  ];
}

function countFiles(dir: string): number {
  try {
    return readdirSync(dir).filter((n) => {
      try {
        return statSync(path.join(dir, n)).isFile();
      } catch {
        return false;
      }
    }).length;
  } catch {
    return 0;
  }
}

type EngineDoc = {
  id?: number;
  storedFilename?: string;
  deleted?: boolean;
  original_file_name?: string | null;
};

/** Lit engine/documents.json (chemin explicite pour éviter le homonyme writer/). */
function readEngineDocuments(root: string): EngineDoc[] {
  const explicit = path.join(root, "engine", "documents.json");
  const file = existsSync(explicit) ? explicit : null;
  if (!file) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as EngineDoc[]) : [];
  } catch {
    return [];
  }
}

function main() {
  const root = dataDir();
  console.log(`\n📂 Data-dir : ${root}`);
  console.log(`📁 Files-dir : ${filesDir(root)}\n`);

  // 1. Création idempotente de l'arborescence.
  console.log("── Arborescence standard ──");
  const dirs = standardDirs(root);
  for (const dir of dirs) {
    const existed = existsSync(dir);
    try {
      mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.log(`  ❌ ${path.relative(root, dir) || dir}  (création impossible : ${e instanceof Error ? e.message : e})`);
      continue;
    }
    const rel = path.relative(root, dir) || dir;
    const n = countFiles(dir);
    console.log(`  ${existed ? "✅" : "🆕"} ${rel.padEnd(20)} ${n > 0 ? `${n} fichier(s)` : ""}`.trimEnd());
  }

  // 2. Inventaire originaux / miniatures (nouvelle arbo + héritée).
  const newOriginals = path.join(filesDir(root), "originals");
  const legacyOriginals = path.join(root, "media", "originals");
  const newThumbs = path.join(filesDir(root), "thumbnails");
  const legacyThumbs = path.join(root, "media", "thumbnails");

  console.log("\n── Inventaire fichiers ──");
  console.log(`  originaux (files/originals) : ${countFiles(newOriginals)}`);
  console.log(`  originaux (media/originals, hérité) : ${countFiles(legacyOriginals)}`);
  console.log(`  miniatures (files/thumbnails) : ${countFiles(newThumbs)}`);
  console.log(`  miniatures (media/thumbnails, hérité) : ${countFiles(legacyThumbs)}`);

  // 3. Vérification : chaque original référencé est présent quelque part.
  const docs = readEngineDocuments(root).filter((d) => !d.deleted);
  let missingOriginal = 0;
  let missingThumb = 0;
  const missingList: string[] = [];

  const hasOriginal = (stored: string) =>
    existsSync(path.join(newOriginals, stored)) || existsSync(path.join(legacyOriginals, stored));
  const hasThumb = (id: number) =>
    existsSync(path.join(newThumbs, `${id}.webp`)) || existsSync(path.join(legacyThumbs, `${id}.webp`));

  for (const d of docs) {
    if (d.storedFilename && !hasOriginal(d.storedFilename)) {
      missingOriginal += 1;
      if (missingList.length < 20) missingList.push(`#${d.id ?? "?"} ${d.original_file_name ?? d.storedFilename}`);
    }
    if (typeof d.id === "number" && !hasThumb(d.id)) missingThumb += 1;
  }

  console.log("\n── Intégrité GED ──");
  console.log(`  documents actifs : ${docs.length}`);
  console.log(`  ${missingOriginal === 0 ? "✅" : "❌"} originaux manquants : ${missingOriginal}`);
  console.log(`  ${missingThumb === 0 ? "✅" : "⚠️ "} sans miniature : ${missingThumb}`);
  if (missingList.length > 0) {
    console.log("    → " + missingList.join("\n    → "));
  }

  console.log("\n✔ Arborescence prête. Aucun fichier déplacé ni supprimé.\n");
  if (missingOriginal > 0) process.exitCode = 1;
}

main();
