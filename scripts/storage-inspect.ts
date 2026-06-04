/* gedify:storage:inspect — inspecte les JSON du data-dir.
   Détecte DATA_DIR, liste les fichiers JSON, compte les entrées, signale les
   JSON invalides. N'écrit rien. */

import path from "node:path";
import { dataDir, entryCount, findJsonFiles, loadJson } from "./_shared";

function main() {
  const root = dataDir();
  console.log(`\n📂 Data-dir détecté : ${root}\n`);

  const files = findJsonFiles(root);
  if (files.length === 0) {
    console.log("Aucun fichier .json trouvé.");
    return;
  }

  let totalEntries = 0;
  let invalid = 0;
  const rows: { file: string; entries: string; status: string }[] = [];

  for (const file of files.sort()) {
    const rel = path.relative(root, file);
    const res = loadJson(file);
    if (!res.ok) {
      invalid += 1;
      rows.push({ file: rel, entries: "—", status: `❌ INVALIDE : ${res.error}` });
      continue;
    }
    const n = entryCount(res.data);
    totalEntries += n;
    const kind = Array.isArray(res.data) ? "tableau" : typeof res.data === "object" ? "objet" : "valeur";
    rows.push({ file: rel, entries: String(n), status: `✅ ${kind}` });
  }

  const w = Math.min(60, Math.max(...rows.map((r) => r.file.length), 10));
  for (const r of rows) {
    console.log(`${r.file.padEnd(w)}  ${r.entries.padStart(6)}  ${r.status}`);
  }

  console.log(`\n— ${files.length} fichier(s), ${totalEntries} entrée(s) au total, ${invalid} invalide(s).\n`);
  if (invalid > 0) process.exitCode = 1;
}

main();
