/* gedify:previews:inspect  (et --clean → gedify:previews:cleanup-orphans)

   Inspection PUR-DISQUE des fichiers dérivés (miniatures, aperçus, pages) face
   aux documents actifs. Sans dépendances natives (pas de génération ici : la
   régénération passe par l'API admin / la page Santé GED).

   - inspect   : compte docs, dérivés présents/manquants, orphelins.
   - --clean   : supprime les fichiers dérivés orphelins (id sans document actif).
                 Ne touche JAMAIS aux originaux ni aux documents. */

import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./_shared";

function envDir(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}
function filesDir(root: string): string {
  return envDir("FILES_DIR") ?? path.join(root, "files");
}

function listFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}
function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
function webpId(name: string): number | null {
  const m = name.match(/^(\d+)\.webp$/);
  return m ? Number(m[1]) : null;
}

type EngineDoc = { id?: number; storedFilename?: string; deleted?: boolean };
function activeDocs(root: string): EngineDoc[] {
  const file = path.join(root, "engine", "documents.json");
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as EngineDoc[]).filter((d) => !d.deleted) : [];
  } catch {
    return [];
  }
}

function main() {
  const clean = process.argv.includes("--clean");
  const root = dataDir();
  const f = filesDir(root);

  const thumbDirs = [path.join(f, "thumbnails"), path.join(root, "media", "thumbnails")];
  const previewDir = path.join(f, "previews");
  const pagesDir = path.join(f, "pages");
  const originalDirs = [path.join(f, "originals"), path.join(root, "media", "originals")];

  const docs = activeDocs(root);
  const activeIds = new Set(docs.map((d) => d.id).filter((n): n is number => typeof n === "number"));
  const originalNames = new Set(originalDirs.flatMap(listFiles));

  // Collecte des dérivés (id → fichiers).
  const thumbFiles = thumbDirs.flatMap((d) => listFiles(d).map((n) => ({ dir: d, name: n, id: webpId(n) })));
  const previewFiles = listFiles(previewDir).map((n) => ({ dir: previewDir, name: n, id: webpId(n) }));
  const pageDirIds = listDirs(pagesDir).map((n) => ({ name: n, id: Number(n) }));

  const thumbIds = new Set(thumbFiles.map((x) => x.id).filter((n): n is number => n != null));
  const previewIds = new Set(previewFiles.map((x) => x.id).filter((n): n is number => n != null));

  let missingThumb = 0;
  let missingPreview = 0;
  let missingOriginal = 0;
  for (const d of docs) {
    if (typeof d.id === "number" && !thumbIds.has(d.id)) missingThumb += 1;
    if (typeof d.id === "number" && !previewIds.has(d.id)) missingPreview += 1;
    if (d.storedFilename && !originalNames.has(d.storedFilename)) missingOriginal += 1;
  }

  const orphanThumbs = thumbFiles.filter((x) => x.id != null && !activeIds.has(x.id));
  const orphanPreviews = previewFiles.filter((x) => x.id != null && !activeIds.has(x.id));
  const orphanPageDirs = pageDirIds.filter((x) => Number.isFinite(x.id) && !activeIds.has(x.id));

  console.log(`\n📂 Data-dir : ${root}`);
  console.log(`📁 Files-dir : ${f}\n`);
  console.log("── Documents vs dérivés ──");
  console.log(`  documents actifs       : ${docs.length}`);
  console.log(`  ${missingThumb === 0 ? "✅" : "⚠️ "} sans miniature        : ${missingThumb}`);
  console.log(`  ${missingPreview === 0 ? "✅" : "⚠️ "} sans aperçu           : ${missingPreview}`);
  console.log(`  ${missingOriginal === 0 ? "✅" : "❌"} originaux manquants   : ${missingOriginal}`);
  console.log("\n── Orphelins (fichiers sans document) ──");
  console.log(`  miniatures orphelines  : ${orphanThumbs.length}`);
  console.log(`  aperçus orphelins      : ${orphanPreviews.length}`);
  console.log(`  dossiers pages orphelins: ${orphanPageDirs.length}`);

  if (clean) {
    let deleted = 0;
    for (const x of [...orphanThumbs, ...orphanPreviews]) {
      try {
        rmSync(path.join(x.dir, x.name), { force: true });
        deleted += 1;
      } catch {
        /* ignore */
      }
    }
    for (const x of orphanPageDirs) {
      try {
        rmSync(path.join(pagesDir, x.name), { recursive: true, force: true });
        deleted += 1;
      } catch {
        /* ignore */
      }
    }
    console.log(`\n🧹 Nettoyage : ${deleted} élément(s) orphelin(s) supprimé(s).`);
  } else {
    const totalOrphans = orphanThumbs.length + orphanPreviews.length + orphanPageDirs.length;
    if (totalOrphans > 0) {
      console.log(`\nℹ️  Relancer avec --clean (gedify:previews:cleanup-orphans) pour supprimer ${totalOrphans} orphelin(s).`);
    }
  }
  console.log("");
  if (missingOriginal > 0) process.exitCode = 1;
}

main();
