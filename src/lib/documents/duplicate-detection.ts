import "server-only";

import { readStore, STORE, type EngineDocument } from "@/lib/engine/stores";

/* ────────────────────────────────────────────────────────────────────────
   Détection de doublons (Partie 2, section E). LECTURE SEULE : ne supprime ni
   ne fusionne rien — surface des groupes à examiner. Les doublons EXACTS sont
   déjà refusés à l'import (checksum) ; on les liste néanmoins (anciens imports)
   et on ajoute les doublons PROBABLES (nom + nombre de pages proches).
   ──────────────────────────────────────────────────────────────────────── */

export type DuplicateKind = "exact" | "probable";
export type DuplicateGroup = {
  kind: DuplicateKind;
  reason: string;
  documents: { id: number; title: string }[];
};

function normalizedTitle(d: EngineDocument): string {
  return (d.original_file_name ?? d.title ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/\.[a-z0-9]+$/, "") // extension
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
  const docs = (await readStore<EngineDocument[]>(STORE.documents, [])).filter((d) => !d.deleted);
  const groups: DuplicateGroup[] = [];

  // 1) Exacts : même empreinte.
  const byHash = new Map<string, EngineDocument[]>();
  for (const d of docs) {
    if (!d.checksum) continue;
    const arr = byHash.get(d.checksum) ?? [];
    arr.push(d);
    byHash.set(d.checksum, arr);
  }
  const exactIds = new Set<number>();
  for (const arr of byHash.values()) {
    if (arr.length > 1) {
      arr.forEach((d) => exactIds.add(d.id));
      groups.push({
        kind: "exact",
        reason: "empreinte (hash) identique",
        documents: arr.map((d) => ({ id: d.id, title: d.title })),
      });
    }
  }

  // 2) Probables : nom normalisé + nombre de pages identiques (hors exacts).
  const byKey = new Map<string, EngineDocument[]>();
  for (const d of docs) {
    if (exactIds.has(d.id)) continue;
    const t = normalizedTitle(d);
    if (t.length < 3) continue;
    const key = `${t}|${d.page_count ?? "?"}`;
    const arr = byKey.get(key) ?? [];
    arr.push(d);
    byKey.set(key, arr);
  }
  for (const arr of byKey.values()) {
    if (arr.length > 1) {
      groups.push({
        kind: "probable",
        reason: "nom et nombre de pages très proches",
        documents: arr.map((d) => ({ id: d.id, title: d.title })),
      });
    }
  }

  return groups;
}

export type DuplicateStats = { groups: number; exact: number; probable: number; documents: number };

export async function duplicateStats(): Promise<DuplicateStats> {
  const g = await findDuplicateGroups();
  return {
    groups: g.length,
    exact: g.filter((x) => x.kind === "exact").length,
    probable: g.filter((x) => x.kind === "probable").length,
    documents: g.reduce((n, x) => n + x.documents.length, 0),
  };
}
