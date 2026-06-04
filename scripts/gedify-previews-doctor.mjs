import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/previews-doctor.ts
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path2 from "node:path";

// scripts/_shared.ts
import path from "node:path";
function dataDir() {
  return process.env.JSON_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || process.env.APP_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}

// scripts/previews-doctor.ts
function envDir(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}
function filesDir(root) {
  return envDir("FILES_DIR") ?? path2.join(root, "files");
}
function listFiles(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}
function listDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
function webpId(name) {
  const m = name.match(/^(\d+)\.webp$/);
  return m ? Number(m[1]) : null;
}
function activeDocs(root) {
  const file = path2.join(root, "engine", "documents.json");
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((d) => !d.deleted) : [];
  } catch {
    return [];
  }
}
function main() {
  const clean = process.argv.includes("--clean");
  const root = dataDir();
  const f = filesDir(root);
  const thumbDirs = [path2.join(f, "thumbnails"), path2.join(root, "media", "thumbnails")];
  const previewDir = path2.join(f, "previews");
  const pagesDir = path2.join(f, "pages");
  const originalDirs = [path2.join(f, "originals"), path2.join(root, "media", "originals")];
  const docs = activeDocs(root);
  const activeIds = new Set(docs.map((d) => d.id).filter((n) => typeof n === "number"));
  const originalNames = new Set(originalDirs.flatMap(listFiles));
  const thumbFiles = thumbDirs.flatMap((d) => listFiles(d).map((n) => ({ dir: d, name: n, id: webpId(n) })));
  const previewFiles = listFiles(previewDir).map((n) => ({ dir: previewDir, name: n, id: webpId(n) }));
  const pageDirIds = listDirs(pagesDir).map((n) => ({ name: n, id: Number(n) }));
  const thumbIds = new Set(thumbFiles.map((x) => x.id).filter((n) => n != null));
  const previewIds = new Set(previewFiles.map((x) => x.id).filter((n) => n != null));
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
  console.log(`
\u{1F4C2} Data-dir : ${root}`);
  console.log(`\u{1F4C1} Files-dir : ${f}
`);
  console.log("\u2500\u2500 Documents vs d\xE9riv\xE9s \u2500\u2500");
  console.log(`  documents actifs       : ${docs.length}`);
  console.log(`  ${missingThumb === 0 ? "\u2705" : "\u26A0\uFE0F "} sans miniature        : ${missingThumb}`);
  console.log(`  ${missingPreview === 0 ? "\u2705" : "\u26A0\uFE0F "} sans aper\xE7u           : ${missingPreview}`);
  console.log(`  ${missingOriginal === 0 ? "\u2705" : "\u274C"} originaux manquants   : ${missingOriginal}`);
  console.log("\n\u2500\u2500 Orphelins (fichiers sans document) \u2500\u2500");
  console.log(`  miniatures orphelines  : ${orphanThumbs.length}`);
  console.log(`  aper\xE7us orphelins      : ${orphanPreviews.length}`);
  console.log(`  dossiers pages orphelins: ${orphanPageDirs.length}`);
  if (clean) {
    let deleted = 0;
    for (const x of [...orphanThumbs, ...orphanPreviews]) {
      try {
        rmSync(path2.join(x.dir, x.name), { force: true });
        deleted += 1;
      } catch {
      }
    }
    for (const x of orphanPageDirs) {
      try {
        rmSync(path2.join(pagesDir, x.name), { recursive: true, force: true });
        deleted += 1;
      } catch {
      }
    }
    console.log(`
\u{1F9F9} Nettoyage : ${deleted} \xE9l\xE9ment(s) orphelin(s) supprim\xE9(s).`);
  } else {
    const totalOrphans = orphanThumbs.length + orphanPreviews.length + orphanPageDirs.length;
    if (totalOrphans > 0) {
      console.log(`
\u2139\uFE0F  Relancer avec --clean (gedify:previews:cleanup-orphans) pour supprimer ${totalOrphans} orphelin(s).`);
    }
  }
  console.log("");
  if (missingOriginal > 0) process.exitCode = 1;
}
main();
