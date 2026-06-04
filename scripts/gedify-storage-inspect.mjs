import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);

// scripts/storage-inspect.ts
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
function loadJson(file) {
  try {
    return { ok: true, data: JSON.parse(readFileSync(file, "utf8")) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
function entryCount(data) {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") return Object.keys(data).length;
  return data == null ? 0 : 1;
}

// scripts/storage-inspect.ts
function main() {
  const root = dataDir();
  console.log(`
\u{1F4C2} Data-dir d\xE9tect\xE9 : ${root}
`);
  const files = findJsonFiles(root);
  if (files.length === 0) {
    console.log("Aucun fichier .json trouv\xE9.");
    return;
  }
  let totalEntries = 0;
  let invalid = 0;
  const rows = [];
  for (const file of files.sort()) {
    const rel = path2.relative(root, file);
    const res = loadJson(file);
    if (!res.ok) {
      invalid += 1;
      rows.push({ file: rel, entries: "\u2014", status: `\u274C INVALIDE : ${res.error}` });
      continue;
    }
    const n = entryCount(res.data);
    totalEntries += n;
    const kind = Array.isArray(res.data) ? "tableau" : typeof res.data === "object" ? "objet" : "valeur";
    rows.push({ file: rel, entries: String(n), status: `\u2705 ${kind}` });
  }
  const w = Math.min(60, Math.max(...rows.map((r) => r.file.length), 10));
  for (const r of rows) {
    console.log(`${r.file.padEnd(w)}  ${r.entries.padStart(6)}  ${r.status}`);
  }
  console.log(`
\u2014 ${files.length} fichier(s), ${totalEntries} entr\xE9e(s) au total, ${invalid} invalide(s).
`);
  if (invalid > 0) process.exitCode = 1;
}
main();
