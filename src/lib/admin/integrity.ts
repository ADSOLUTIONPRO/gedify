import "server-only";

import fs from "node:fs";
import { readStore, STORE, originalsDir, type EngineDocument } from "@/lib/engine/stores";
import { legacyMediaSubdir } from "@/lib/storage/ged-paths";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { listMailDocumentLinks } from "@/lib/messaging/mail-document-links-store";

/* ────────────────────────────────────────────────────────────────────────
   Diagnostic d'INTÉGRITÉ (Partie 8). Lecture seule : détecte les anomalies
   sans rien modifier (documents sans fichier original, fichiers orphelins,
   liens budget/mail cassés). Alimente la Santé GED + le CLI.
   ──────────────────────────────────────────────────────────────────────── */

export type IntegrityReport = {
  documents: number;
  docsWithoutOriginal: number;
  orphanOriginals: number;
  docsWithoutOcr: number;
  brokenBudgetLinks: number;
  brokenMailLinks: number;
  generatedAt: string;
};

function listFilenames(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function computeIntegrity(): Promise<IntegrityReport> {
  const docs = (await readStore<EngineDocument[]>(STORE.documents, [])).filter((d) => !d.deleted);
  const activeIds = new Set(docs.map((d) => d.id));

  // Fichiers originaux présents (nouvelle arbo + héritée).
  const originalNames = new Set([
    ...listFilenames(originalsDir()),
    ...listFilenames(legacyMediaSubdir("originals")),
  ]);

  let docsWithoutOriginal = 0;
  let docsWithoutOcr = 0;
  for (const d of docs) {
    if (d.storedFilename && !originalNames.has(d.storedFilename)) docsWithoutOriginal += 1;
    if (!(d.content ?? "").trim()) docsWithoutOcr += 1;
  }

  // Originaux orphelins : fichier <id>.<ext> dont l'id n'est plus actif.
  let orphanOriginals = 0;
  for (const name of originalNames) {
    const m = name.match(/^(\d+)/);
    if (m && !activeIds.has(Number(m[1]))) orphanOriginals += 1;
  }

  // Liens budget cassés : sourceDocumentId pointant vers un document inexistant.
  let brokenBudgetLinks = 0;
  try {
    const items = await listFinancialItems();
    for (const it of items) {
      if (it.sourceDocumentId != null && !activeIds.has(it.sourceDocumentId)) brokenBudgetLinks += 1;
    }
  } catch {
    /* budget indisponible */
  }

  // Liens mail cassés : paperlessDocumentId pointant vers un document inexistant.
  let brokenMailLinks = 0;
  try {
    const links = await listMailDocumentLinks();
    for (const l of links) {
      if (l.paperlessDocumentId != null && !activeIds.has(l.paperlessDocumentId)) brokenMailLinks += 1;
    }
  } catch {
    /* mails indisponibles */
  }

  return {
    documents: docs.length,
    docsWithoutOriginal,
    orphanOriginals,
    docsWithoutOcr,
    brokenBudgetLinks,
    brokenMailLinks,
    generatedAt: new Date().toISOString(),
  };
}

/** Liste détaillée (ids) pour les outils — bornée pour rester légère. */
export async function integrityDetails(limit = 100): Promise<{
  docsWithoutOriginal: number[];
  orphanOriginalFiles: string[];
}> {
  const docs = (await readStore<EngineDocument[]>(STORE.documents, [])).filter((d) => !d.deleted);
  const activeIds = new Set(docs.map((d) => d.id));
  const dir = originalsDir();
  const originalNames = new Set([...listFilenames(dir), ...listFilenames(legacyMediaSubdir("originals"))]);

  const docsWithoutOriginal = docs
    .filter((d) => d.storedFilename && !originalNames.has(d.storedFilename))
    .map((d) => d.id)
    .slice(0, limit);

  const orphanOriginalFiles = [...originalNames]
    .filter((name) => {
      const m = name.match(/^(\d+)/);
      return m && !activeIds.has(Number(m[1]));
    })
    .slice(0, limit);

  return { docsWithoutOriginal, orphanOriginalFiles };
}
