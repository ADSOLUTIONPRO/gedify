import "server-only";

import { mutateList, readStore, STORE, type EngineDocument, type EngineObject } from "@/lib/engine/stores";
import { reindexAll } from "@/lib/engine/search";

/* ────────────────────────────────────────────────────────────────────────
   Fusion de taxonomies (Partie 5) : tags / correspondents / document_types.
   Réaffecte les références des documents vers l'entrée « maître » puis supprime
   les entrées fusionnées. Idempotent. NON destructif pour les documents (ils
   sont seulement re-référencés). Réindexe ensuite (les noms changent).
   ──────────────────────────────────────────────────────────────────────── */

export type TaxonomyResource = "tags" | "correspondents" | "document_types";

const STORE_KEY: Record<TaxonomyResource, string> = {
  tags: STORE.tags,
  correspondents: STORE.correspondents,
  document_types: STORE.document_types,
};

export type TaxonomyMergeResult = { ok: boolean; resource: TaxonomyResource; keptId: number; mergedIds: number[]; affectedDocuments: number; message: string };

export async function mergeTaxonomy(
  resource: TaxonomyResource,
  keepId: number,
  mergeIdsInput: number[],
): Promise<TaxonomyMergeResult> {
  const ids = new Set(mergeIdsInput.map(Number).filter((x) => Number.isFinite(x) && x !== keepId));
  if (ids.size === 0) {
    return { ok: false, resource, keptId: keepId, mergedIds: [], affectedDocuments: 0, message: "Aucune entrée à fusionner." };
  }

  // Le maître doit exister.
  const items = await readStore<EngineObject[]>(STORE_KEY[resource], []);
  if (!items.some((i) => Number(i.id) === keepId)) {
    return { ok: false, resource, keptId: keepId, mergedIds: [], affectedDocuments: 0, message: "Entrée maître introuvable." };
  }

  // Réaffectation des références dans les documents.
  let affected = 0;
  await mutateList<EngineDocument>(STORE.documents, (list) =>
    list.map((d) => {
      if (resource === "tags") {
        if (d.tags?.some((t) => ids.has(t))) {
          affected += 1;
          return { ...d, tags: [...new Set(d.tags.map((t) => (ids.has(t) ? keepId : t)))] };
        }
      } else if (resource === "correspondents") {
        if (d.correspondent != null && ids.has(d.correspondent)) {
          affected += 1;
          return { ...d, correspondent: keepId };
        }
      } else if (resource === "document_types") {
        if (d.document_type != null && ids.has(d.document_type)) {
          affected += 1;
          return { ...d, document_type: keepId };
        }
      }
      return d;
    }),
  );

  // Correspondants secondaires : réaffecter le maître à la place des fusionnés.
  if (resource === "correspondents") {
    try {
      const { reassignSecondaryCorrespondent } = await import("@/lib/documents/secondary-correspondents-store");
      for (const mid of ids) await reassignSecondaryCorrespondent(mid, keepId);
    } catch {
      /* store secondaire indisponible → ignoré */
    }
  }

  // Suppression des entrées fusionnées.
  await mutateList<EngineObject>(STORE_KEY[resource], (list) => list.filter((i) => !ids.has(Number(i.id))));

  // Réindexation (les noms de tags/correspondants/types ont changé).
  await reindexAll().catch(() => {});

  return {
    ok: true,
    resource,
    keptId: keepId,
    mergedIds: [...ids],
    affectedDocuments: affected,
    message: `${ids.size} entrée(s) fusionnée(s) dans #${keepId} (${affected} document(s) re-référencé(s)).`,
  };
}
