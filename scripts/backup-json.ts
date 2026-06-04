/* gedify:backup-json — copie TOUS les JSON dans
   <data-dir>/backups/json-before-migration-YYYY-MM-DD-HHMMSS/ en préservant
   l'arborescence relative. Ne supprime jamais rien. */

import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { dataDir, findJsonFiles, timestamp } from "./_shared";

/** Réutilisable par le script de migration (backup automatique avant migration). */
export function backupJson(): { backupDir: string; count: number } {
  const root = dataDir();
  const backupDir = path.join(root, "backups", `json-before-migration-${timestamp()}`);
  const files = findJsonFiles(root); // findJsonFiles exclut déjà backups/

  for (const file of files) {
    const rel = path.relative(root, file);
    const dest = path.join(backupDir, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(file, dest);
  }
  return { backupDir, count: files.length };
}

function main() {
  const { backupDir, count } = backupJson();
  console.log(`\n💾 Sauvegarde JSON : ${count} fichier(s) copié(s) dans\n   ${backupDir}\n(les sources ne sont PAS supprimées)\n`);
}

// Exécuté directement (pas seulement importé) ?
if (process.argv[1] && process.argv[1].includes("backup-json")) {
  main();
}
