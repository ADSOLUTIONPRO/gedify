import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/storage-doctor.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path2 from "node:path";

// scripts/_shared.ts
import path from "node:path";
function dataDir() {
  return process.env.JSON_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || process.env.APP_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}

// scripts/storage-doctor.ts
var FILE_CATEGORIES = [
  "originals",
  "archives",
  "thumbnails",
  "previews",
  "pages",
  "signed",
  "trash",
  "tmp"
];
function envDir(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}
function filesDir(root) {
  return envDir("FILES_DIR") ?? path2.join(root, "files");
}
function backupsDir(root) {
  return envDir("BACKUPS_DIR") ?? path2.join(root, "backups");
}
function standardDirs(root) {
  const f = filesDir(root);
  return [
    f,
    ...FILE_CATEGORIES.map((c) => path2.join(f, c)),
    path2.join(root, "ocr"),
    path2.join(root, "ai"),
    path2.join(root, "cache"),
    path2.join(root, "logs"),
    backupsDir(root)
  ];
}
function countFiles(dir) {
  try {
    return readdirSync(dir).filter((n) => {
      try {
        return statSync(path2.join(dir, n)).isFile();
      } catch {
        return false;
      }
    }).length;
  } catch {
    return 0;
  }
}
function readEngineDocuments(root) {
  const explicit = path2.join(root, "engine", "documents.json");
  const file = existsSync(explicit) ? explicit : null;
  if (!file) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function main() {
  const root = dataDir();
  console.log(`
\u{1F4C2} Data-dir : ${root}`);
  console.log(`\u{1F4C1} Files-dir : ${filesDir(root)}
`);
  console.log("\u2500\u2500 Arborescence standard \u2500\u2500");
  const dirs = standardDirs(root);
  for (const dir of dirs) {
    const existed = existsSync(dir);
    try {
      mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.log(`  \u274C ${path2.relative(root, dir) || dir}  (cr\xE9ation impossible : ${e instanceof Error ? e.message : e})`);
      continue;
    }
    const rel = path2.relative(root, dir) || dir;
    const n = countFiles(dir);
    console.log(`  ${existed ? "\u2705" : "\u{1F195}"} ${rel.padEnd(20)} ${n > 0 ? `${n} fichier(s)` : ""}`.trimEnd());
  }
  const newOriginals = path2.join(filesDir(root), "originals");
  const legacyOriginals = path2.join(root, "media", "originals");
  const newThumbs = path2.join(filesDir(root), "thumbnails");
  const legacyThumbs = path2.join(root, "media", "thumbnails");
  console.log("\n\u2500\u2500 Inventaire fichiers \u2500\u2500");
  console.log(`  originaux (files/originals) : ${countFiles(newOriginals)}`);
  console.log(`  originaux (media/originals, h\xE9rit\xE9) : ${countFiles(legacyOriginals)}`);
  console.log(`  miniatures (files/thumbnails) : ${countFiles(newThumbs)}`);
  console.log(`  miniatures (media/thumbnails, h\xE9rit\xE9) : ${countFiles(legacyThumbs)}`);
  const docs = readEngineDocuments(root).filter((d) => !d.deleted);
  let missingOriginal = 0;
  let missingThumb = 0;
  const missingList = [];
  const hasOriginal = (stored) => existsSync(path2.join(newOriginals, stored)) || existsSync(path2.join(legacyOriginals, stored));
  const hasThumb = (id) => existsSync(path2.join(newThumbs, `${id}.webp`)) || existsSync(path2.join(legacyThumbs, `${id}.webp`));
  for (const d of docs) {
    if (d.storedFilename && !hasOriginal(d.storedFilename)) {
      missingOriginal += 1;
      if (missingList.length < 20) missingList.push(`#${d.id ?? "?"} ${d.original_file_name ?? d.storedFilename}`);
    }
    if (typeof d.id === "number" && !hasThumb(d.id)) missingThumb += 1;
  }
  console.log("\n\u2500\u2500 Int\xE9grit\xE9 GED \u2500\u2500");
  console.log(`  documents actifs : ${docs.length}`);
  console.log(`  ${missingOriginal === 0 ? "\u2705" : "\u274C"} originaux manquants : ${missingOriginal}`);
  console.log(`  ${missingThumb === 0 ? "\u2705" : "\u26A0\uFE0F "} sans miniature : ${missingThumb}`);
  if (missingList.length > 0) {
    console.log("    \u2192 " + missingList.join("\n    \u2192 "));
  }
  console.log("\n\u2714 Arborescence pr\xEAte. Aucun fichier d\xE9plac\xE9 ni supprim\xE9.\n");
  if (missingOriginal > 0) process.exitCode = 1;
}
main();
