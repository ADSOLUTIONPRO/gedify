/* Diagnostic d'INTÉGRITÉ PUR-DISQUE (Partie 8). Sans deps natives, sans tsx.
   100 % LECTURE SEULE — ne modifie, ne supprime, ne déplace AUCUN fichier.

   Détecte :
   - documents sans fichier original (storedFilename absent du disque) ;
   - fichiers originaux orphelins (aucun document actif ne les référence) ;
   - documents sans OCR (content vide) ;
   - liens budget cassés (sourceDocumentId → document inexistant) ;
   - liens mail cassés (paperlessDocumentId → document inexistant).

   Usage :
     inspect (défaut)  : synthèse chiffrée + alertes.
     --missing         : liste les documents sans fichier original.
     --orphans         : liste les fichiers originaux orphelins.
     --json            : sortie JSON (rapport pour Santé GED / supervision). */

import { readdirSync } from "node:fs";
import path from "node:path";
import { dataDir, loadArray } from "./_shared";

type Doc = { id?: number; content?: string; deleted?: boolean; storedFilename?: string };
type FinancialItem = { sourceDocumentId?: number | null };
type MailLink = { paperlessDocumentId?: number | null };

function listFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

function main() {
  const argv = process.argv;
  const root = dataDir();

  const docs = loadArray<Doc>(root, "documents.json").filter((d) => !d.deleted);
  const activeIds = new Set<number>(docs.map((d) => Number(d.id)).filter(Number.isFinite));

  // Originaux présents : nouvelle arbo files/originals + héritée media/originals.
  const originalNames = new Set<string>([
    ...listFiles(path.join(root, "files", "originals")),
    ...listFiles(path.join(root, "media", "originals")),
  ]);

  const docsWithoutOriginal: number[] = [];
  let docsWithoutOcr = 0;
  for (const d of docs) {
    if (d.storedFilename && !originalNames.has(d.storedFilename)) docsWithoutOriginal.push(Number(d.id));
    if (!(d.content ?? "").trim()) docsWithoutOcr += 1;
  }

  const orphanOriginals: string[] = [];
  for (const name of originalNames) {
    const m = name.match(/^(\d+)/);
    if (m && !activeIds.has(Number(m[1]))) orphanOriginals.push(name);
  }

  const financial = loadArray<FinancialItem>(root, "financial-items.json");
  const brokenBudgetLinks = financial.filter(
    (it) => it.sourceDocumentId != null && !activeIds.has(Number(it.sourceDocumentId)),
  ).length;

  const mailLinks = loadArray<MailLink>(root, "mail-document-links.json");
  const brokenMailLinks = mailLinks.filter(
    (l) => l.paperlessDocumentId != null && !activeIds.has(Number(l.paperlessDocumentId)),
  ).length;

  const report = {
    status: docsWithoutOriginal.length || brokenBudgetLinks || brokenMailLinks ? "warning" : "ok",
    dataDir: root,
    documents: docs.length,
    originalsOnDisk: originalNames.size,
    docsWithoutOriginal: docsWithoutOriginal.length,
    orphanOriginals: orphanOriginals.length,
    docsWithoutOcr,
    brokenBudgetLinks,
    brokenMailLinks,
    generatedAt: new Date().toISOString(),
  };

  if (argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (argv.includes("--missing")) {
    console.log(`\n📄 Documents sans fichier original : ${docsWithoutOriginal.length}`);
    for (const id of docsWithoutOriginal.slice(0, 100)) console.log(`  #${id}`);
    if (docsWithoutOriginal.length > 100) console.log(`  … (+${docsWithoutOriginal.length - 100})`);
    console.log("\nℹ️  Restaurez depuis une sauvegarde — ne supprimez PAS ces documents.\n");
    return;
  }
  if (argv.includes("--orphans")) {
    console.log(`\n🗂️  Fichiers originaux orphelins : ${orphanOriginals.length}`);
    for (const n of orphanOriginals.slice(0, 100)) console.log(`  ${n}`);
    if (orphanOriginals.length > 100) console.log(`  … (+${orphanOriginals.length - 100})`);
    console.log("\nℹ️  Aucun document actif ne les référence. Vérifiez avant tout nettoyage manuel.\n");
    return;
  }

  console.log(`\n🩺 Intégrité Gedify — ${root}`);
  console.log(`📄 Documents actifs        : ${report.documents}`);
  console.log(`🗂️  Originaux sur disque     : ${report.originalsOnDisk}`);
  console.log("\n── Anomalies ──");
  console.log(`  documents sans original  : ${report.docsWithoutOriginal}${report.docsWithoutOriginal ? "  ⚠️" : ""}`);
  console.log(`  originaux orphelins      : ${report.orphanOriginals}`);
  console.log(`  documents sans OCR       : ${report.docsWithoutOcr}`);
  console.log(`  liens budget cassés      : ${report.brokenBudgetLinks}${report.brokenBudgetLinks ? "  ⚠️" : ""}`);
  console.log(`  liens mail cassés        : ${report.brokenMailLinks}${report.brokenMailLinks ? "  ⚠️" : ""}`);
  console.log(`\nStatut global : ${report.status === "ok" ? "✅ ok" : "⚠️ warning"}`);
  console.log("\nℹ️  Options : --missing · --orphans · --json   (100 % lecture seule)\n");
}

main();
