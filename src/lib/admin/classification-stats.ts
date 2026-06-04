import "server-only";

import { readStore, STORE, type EngineDocument, type EngineNamed, type EngineTag } from "@/lib/engine/stores";
import { listProjectFolders } from "@/lib/projects/project-store";

/* ────────────────────────────────────────────────────────────────────────
   Statistiques de CLASSEMENT (Partie 5). Lecture seule : sans tag/type/
   correspondant/dossier, à vérifier, tags/types inutilisés, dossiers vides,
   correspondants doublons probables. Sert la Santé GED + le CLI.
   ──────────────────────────────────────────────────────────────────────── */

export type ClassificationStats = {
  total: number;
  withoutTag: number;
  withoutType: number;
  withoutCorrespondent: number;
  withoutFolder: number;
  needsReview: number;
  unusedTags: number;
  unusedTypes: number;
  emptyFolders: number;
  correspondentDuplicates: number;
};

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function computeClassificationStats(): Promise<ClassificationStats> {
  const [docsAll, tags, types, correspondents, folders] = await Promise.all([
    readStore<EngineDocument[]>(STORE.documents, []),
    readStore<EngineTag[]>(STORE.tags, []),
    readStore<EngineNamed[]>(STORE.document_types, []),
    readStore<EngineNamed[]>(STORE.correspondents, []),
    listProjectFolders().catch(() => []),
  ]);
  const docs = docsAll.filter((d) => !d.deleted);

  const inFolder = new Set<number>();
  for (const f of folders) for (const id of f.linkedDocumentIds ?? []) inFolder.add(Number(id));

  const usedTags = new Set<number>();
  const usedTypes = new Set<number>();
  let withoutTag = 0, withoutType = 0, withoutCorrespondent = 0, withoutFolder = 0, needsReview = 0;

  for (const d of docs) {
    if (!(d.tags?.length)) withoutTag += 1;
    else for (const t of d.tags) usedTags.add(t);
    if (d.document_type == null) withoutType += 1;
    else usedTypes.add(d.document_type);
    if (d.correspondent == null) withoutCorrespondent += 1;
    if (!inFolder.has(d.id)) withoutFolder += 1;
    if (d.needs_review_reason || d.ai_status === "failed") needsReview += 1;
  }

  const unusedTags = tags.filter((t) => !usedTags.has(t.id)).length;
  const unusedTypes = types.filter((t) => !usedTypes.has(t.id)).length;

  // Dossiers vides : aucun document lié ET aucun sous-dossier.
  const parentIds = new Set<string>();
  for (const f of folders) if (f.parentId) parentIds.add(f.parentId);
  const emptyFolders = folders.filter(
    (f) => (f.linkedDocumentIds?.length ?? 0) === 0 && !parentIds.has(f.id),
  ).length;

  // Correspondants doublons probables : collision de nom normalisé.
  const byNorm = new Map<string, number>();
  for (const c of correspondents) {
    const n = norm(c.name);
    if (n.length < 2) continue;
    byNorm.set(n, (byNorm.get(n) ?? 0) + 1);
  }
  const correspondentDuplicates = [...byNorm.values()].filter((v) => v > 1).length;

  return {
    total: docs.length,
    withoutTag,
    withoutType,
    withoutCorrespondent,
    withoutFolder,
    needsReview,
    unusedTags,
    unusedTypes,
    emptyFolders,
    correspondentDuplicates,
  };
}
