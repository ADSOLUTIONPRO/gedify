import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/backup-json.ts
import { copyFileSync, mkdirSync } from "node:fs";
import path2 from "node:path";

// scripts/_shared.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
function dataDir() {
  return process.env.JSON_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || process.env.APP_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}
var SKIP_DIRS = /* @__PURE__ */ new Set(["backups", "node_modules", ".next", ".git", "media", "tessdata"]);
function findJsonFiles(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
      } else if (name.endsWith(".json")) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}
function timestamp() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// scripts/backup-json.ts
function backupJson() {
  const root = dataDir();
  const backupDir = path2.join(root, "backups", `json-before-migration-${timestamp()}`);
  const files = findJsonFiles(root);
  for (const file of files) {
    const rel = path2.relative(root, file);
    const dest = path2.join(backupDir, rel);
    mkdirSync(path2.dirname(dest), { recursive: true });
    copyFileSync(file, dest);
  }
  return { backupDir, count: files.length };
}
function main() {
  const { backupDir, count } = backupJson();
  console.log(`
\u{1F4BE} Sauvegarde JSON : ${count} fichier(s) copi\xE9(s) dans
   ${backupDir}
(les sources ne sont PAS supprim\xE9es)
`);
}
if (process.argv[1] && process.argv[1].includes("backup-json")) {
  main();
}
export {
  backupJson
};
