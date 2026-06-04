import "server-only";

import { mutateList, readStore, STORE, type EngineDocument } from "@/lib/engine/stores";
import { indexDocument, removeFromIndex } from "@/lib/engine/search";
import { loadNameMaps } from "@/lib/engine/helpers";
import {
  listProjectFolders,
  linkProjectDocuments,
  unlinkProjectDocuments,
} from "@/lib/projects/project-store";

/* ────────────────────────────────────────────────────────────────────────
   Fusion de doublons (Partie 2, section E). Conserve un document « maître » et
   envoie les autres à la CORBEILLE (soft-delete, récupérable) — JAMAIS de
   suppression définitive ni de perte de fichier. Les tags sont fusionnés, le
   correspondant/type repris si le maître en manque, et les appartenances aux
   dossiers transférées vers le maître.
   ──────────────────────────────────────────────────────────────────────── */

export type MergeResult = {
  ok: boolean;
  keptId: number;
  mergedIds: number[];
  message: string;
};

export async function mergeDuplicates(keepId: number, mergeIdsInput: number[]): Promise<MergeResult> {
  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  const keep = docs.find((d) => d.id === keepId && !d.deleted);
  if (!keep) return { ok: false, keptId: keepId, mergedIds: [], message: "Document maître introuvable." };

  const mergeIds = [...new Set(mergeIdsInput)].filter((id) => id !== keepId);
  const merged = docs.filter((d) => mergeIds.includes(d.id) && !d.deleted);
  if (merged.length === 0) {
    return { ok: false, keptId: keepId, mergedIds: [], message: "Aucun document à fusionner." };
  }

  // Fusion des métadonnées sur le maître (sans écraser une valeur existante).
  const tags = new Set<number>(keep.tags ?? []);
  let correspondent = keep.correspondent;
  let documentType = keep.document_type;
  for (const m of merged) {
    for (const t of m.tags ?? []) tags.add(t);
    if (correspondent == null && m.correspondent != null) correspondent = m.correspondent;
    if (documentType == null && m.document_type != null) documentType = m.document_type;
  }

  const nowIso = new Date().toISOString();
  const mergedSet = new Set(merged.map((m) => m.id));
  await mutateList<EngineDocument>(STORE.documents, (list) =>
    list.map((d) => {
      if (d.id === keepId) {
        return { ...d, tags: [...tags], correspondent, document_type: documentType, modified: nowIso };
      }
      if (mergedSet.has(d.id)) {
        return { ...d, deleted: true, deletedAt: nowIso }; // corbeille (réversible)
      }
      return d;
    }),
  );

  // Transfert des appartenances aux dossiers vers le maître.
  try {
    const folders = await listProjectFolders();
    for (const f of folders) {
      const linked = (f.linkedDocumentIds ?? []).filter((id) => mergedSet.has(id));
      if (linked.length > 0) {
        await linkProjectDocuments(f.id, [keepId]);
        await unlinkProjectDocuments(f.id, linked);
      }
    }
  } catch {
    /* dossiers indisponibles → non bloquant */
  }

  // Index : retirer les fusionnés, réindexer le maître.
  try {
    const maps = await loadNameMaps();
    for (const id of mergedSet) await removeFromIndex(id);
    const after = (await readStore<EngineDocument[]>(STORE.documents, [])).find((d) => d.id === keepId);
    if (after) await indexDocument(after, maps.correspondents, maps.document_types, maps.tags);
  } catch {
    /* index best-effort */
  }

  return {
    ok: true,
    keptId: keepId,
    mergedIds: [...mergedSet],
    message: `${mergedSet.size} doublon(s) fusionné(s) dans le document #${keepId} (envoyés à la corbeille).`,
  };
}
