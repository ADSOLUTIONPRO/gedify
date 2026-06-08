import "server-only";

import { readStore, STORE, slugify, type EngineObject } from "@/lib/engine/stores";
import { ensureTaxonomyByName } from "@/lib/engine/router";
import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { getDocument, updateDocument } from "@/lib/paperless";
import type { AIAnalysis } from "@/lib/ai/types";

/* ────────────────────────────────────────────────────────────────────────
   Audit + réparation des taxonomies « orphelines » : valeurs (tags / types /
   correspondants) suggérées par l'IA et VALIDÉES par l'utilisateur mais qui
   n'existent pas comme entité réelle (régression historique). On ne répare QUE
   les analyses status applied/validated — jamais des chaînes brutes d'OCR.
   ──────────────────────────────────────────────────────────────────────── */

const REPAIRABLE_STATUSES: ReadonlySet<AIAnalysis["status"]> = new Set(["applied", "validated"]);

async function slugSet(store: string): Promise<Set<string>> {
  const list = await readStore<EngineObject[]>(store, []);
  return new Set(list.map((i) => slugify(String(i.name ?? ""))).filter(Boolean));
}

export type TaxonomyHealth = {
  counts: { tags: number; correspondents: number; documentTypes: number };
  orphans: { tags: string[]; correspondents: string[]; documentTypes: string[] };
  orphanCount: number;
  validatedAnalyses: number;
};

/** Diagnostic : compte les entités + repère les valeurs validées sans entité. */
export async function auditTaxonomies(): Promise<TaxonomyHealth> {
  const [tags, correspondents, documentTypes, analyses] = await Promise.all([
    readStore<EngineObject[]>(STORE.tags, []),
    readStore<EngineObject[]>(STORE.correspondents, []),
    readStore<EngineObject[]>(STORE.document_types, []),
    listAnalyses(),
  ]);
  const tagSlugs = new Set(tags.map((t) => slugify(String(t.name ?? ""))));
  const corrSlugs = new Set(correspondents.map((c) => slugify(String(c.name ?? ""))));
  const typeSlugs = new Set(documentTypes.map((t) => slugify(String(t.name ?? ""))));

  const orphanTags = new Map<string, string>();
  const orphanCorr = new Map<string, string>();
  const orphanTypes = new Map<string, string>();
  let validated = 0;

  for (const a of analyses) {
    if (!REPAIRABLE_STATUSES.has(a.status)) continue;
    validated += 1;
    for (const name of a.suggestedTagNames ?? []) {
      const s = slugify(name);
      if (s && !tagSlugs.has(s)) orphanTags.set(s, name.trim());
    }
    if (a.suggestedCorrespondentName) {
      const s = slugify(a.suggestedCorrespondentName);
      if (s && !corrSlugs.has(s)) orphanCorr.set(s, a.suggestedCorrespondentName.trim());
    }
    if (a.suggestedDocumentTypeName) {
      const s = slugify(a.suggestedDocumentTypeName);
      if (s && !typeSlugs.has(s)) orphanTypes.set(s, a.suggestedDocumentTypeName.trim());
    }
  }

  const orphans = {
    tags: [...orphanTags.values()],
    correspondents: [...orphanCorr.values()],
    documentTypes: [...orphanTypes.values()],
  };
  return {
    counts: { tags: tags.length, correspondents: correspondents.length, documentTypes: documentTypes.length },
    orphans,
    orphanCount: orphans.tags.length + orphans.correspondents.length + orphans.documentTypes.length,
    validatedAnalyses: validated,
  };
}

export type RepairReport = {
  tagsCreated: string[];
  typesCreated: string[];
  correspondentsCreated: string[];
  relationsRepaired: number;
  valuesIgnored: number;
  errors: string[];
};

/**
 * Réparation : pour chaque analyse validée, (re)crée les entités suggérées
 * manquantes et reconnecte le document (sans écraser un choix existant :
 * correspondant/type seulement si vides, tags en union). Idempotent.
 */
export async function repairTaxonomies(): Promise<RepairReport> {
  const report: RepairReport = {
    tagsCreated: [], typesCreated: [], correspondentsCreated: [],
    relationsRepaired: 0, valuesIgnored: 0, errors: [],
  };
  const existingTagSlugs = await slugSet(STORE.tags);
  const existingCorrSlugs = await slugSet(STORE.correspondents);
  const existingTypeSlugs = await slugSet(STORE.document_types);

  const analyses = await listAnalyses();
  for (const a of analyses) {
    if (!REPAIRABLE_STATUSES.has(a.status)) continue;
    try {
      const doc = await getDocument(a.documentId).catch(() => null);
      if (!doc) { report.valuesIgnored += 1; continue; }
      const update: { correspondent?: number; document_type?: number; tags?: number[] } = {};

      // Correspondant : seulement si le document n'en a pas.
      if (a.suggestedCorrespondentName && doc.correspondent == null) {
        const s = slugify(a.suggestedCorrespondentName);
        const ensured = await ensureTaxonomyByName("correspondents", a.suggestedCorrespondentName);
        if (ensured) {
          if (ensured.created && !existingCorrSlugs.has(s)) { report.correspondentsCreated.push(ensured.entity.name as string); existingCorrSlugs.add(s); }
          update.correspondent = Number(ensured.entity.id);
        }
      }
      // Type : seulement si le document n'en a pas.
      if (a.suggestedDocumentTypeName && doc.document_type == null) {
        const s = slugify(a.suggestedDocumentTypeName);
        const ensured = await ensureTaxonomyByName("document_types", a.suggestedDocumentTypeName);
        if (ensured) {
          if (ensured.created && !existingTypeSlugs.has(s)) { report.typesCreated.push(ensured.entity.name as string); existingTypeSlugs.add(s); }
          update.document_type = Number(ensured.entity.id);
        }
      }
      // Tags : union avec les tags actuels du document.
      const currentTags: number[] = Array.isArray(doc.tags) ? doc.tags : [];
      const tagSet = new Set<number>(currentTags);
      let addedTag = false;
      for (const name of a.suggestedTagNames ?? []) {
        const s = slugify(name);
        if (!s) continue;
        const ensured = await ensureTaxonomyByName("tags", name);
        if (ensured) {
          if (ensured.created && !existingTagSlugs.has(s)) { report.tagsCreated.push(ensured.entity.name as string); existingTagSlugs.add(s); }
          const tid = Number(ensured.entity.id);
          if (!tagSet.has(tid)) { tagSet.add(tid); addedTag = true; }
        }
      }
      if (addedTag) update.tags = [...tagSet];

      if (update.correspondent !== undefined || update.document_type !== undefined || update.tags !== undefined) {
        await updateDocument(a.documentId, update);
        report.relationsRepaired += 1;
      }
    } catch (e) {
      report.errors.push(`doc #${a.documentId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return report;
}
