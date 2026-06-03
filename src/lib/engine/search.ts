import "server-only";

import MiniSearch from "minisearch";
import {
  readStore,
  STORE,
  type EngineDocument,
  type EngineNamed,
  type EngineTag,
} from "./stores";

/* ────────────────────────────────────────────────────────────────────────
   Recherche plein-texte locale (remplace l'index Whoosh de Paperless).
   Index minisearch en mémoire, reconstruit depuis les stores au 1er usage.
   ──────────────────────────────────────────────────────────────────────── */

type IndexDoc = {
  id: number;
  title: string;
  content: string;
  correspondent: string;
  document_type: string;
  tags: string;
};

let index: MiniSearch<IndexDoc> | null = null;
let building: Promise<void> | null = null;

function newIndex() {
  return new MiniSearch<IndexDoc>({
    fields: ["title", "content", "correspondent", "document_type", "tags"],
    storeFields: ["id", "title"],
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 3, correspondent: 2 } },
  });
}

function toIndexDoc(
  d: EngineDocument,
  corr: Map<number, string>,
  types: Map<number, string>,
  tags: Map<number, string>,
): IndexDoc {
  return {
    id: d.id,
    title: d.title ?? "",
    content: d.content ?? "",
    correspondent: d.correspondent != null ? corr.get(d.correspondent) ?? "" : "",
    document_type: d.document_type != null ? types.get(d.document_type) ?? "" : "",
    tags: (d.tags ?? []).map((t) => tags.get(t) ?? "").join(" "),
  };
}

async function build(): Promise<void> {
  const [docs, corrList, typeList, tagList] = await Promise.all([
    readStore<EngineDocument[]>(STORE.documents, []),
    readStore<EngineNamed[]>(STORE.correspondents, []),
    readStore<EngineNamed[]>(STORE.document_types, []),
    readStore<EngineTag[]>(STORE.tags, []),
  ]);
  const corr = new Map(corrList.map((c) => [c.id, c.name]));
  const types = new Map(typeList.map((t) => [t.id, t.name]));
  const tags = new Map(tagList.map((t) => [t.id, t.name]));
  const fresh = newIndex();
  fresh.addAll(docs.filter((d) => !d.deleted).map((d) => toIndexDoc(d, corr, types, tags)));
  index = fresh;
}

async function ensureIndex(): Promise<MiniSearch<IndexDoc>> {
  if (index) return index;
  if (!building) building = build().finally(() => (building = null));
  await building;
  return index ?? newIndex();
}

/** Force une reconstruction complète (après import massif / changement de taxo). */
export async function reindexAll(): Promise<void> {
  index = null;
  await ensureIndex();
}

/** Ajoute/replace un document dans l'index (best-effort). */
export async function indexDocument(
  d: EngineDocument,
  corr: Map<number, string>,
  types: Map<number, string>,
  tags: Map<number, string>,
): Promise<void> {
  const idx = await ensureIndex();
  const doc = toIndexDoc(d, corr, types, tags);
  try {
    idx.discard(d.id);
  } catch {
    /* pas encore indexé */
  }
  try {
    idx.add(doc);
  } catch {
    /* doublon transitoire → ignoré */
  }
}

export async function removeFromIndex(id: number): Promise<void> {
  const idx = await ensureIndex();
  try {
    idx.discard(id);
  } catch {
    /* absent */
  }
}

/** Recherche plein-texte → ids classés par pertinence décroissante. */
export async function searchIds(query: string): Promise<{ id: number; score: number }[]> {
  const q = query.trim();
  if (!q) return [];
  const idx = await ensureIndex();
  return idx.search(q).map((r) => ({ id: Number(r.id), score: r.score }));
}

/** Documents voisins (« plus comme celui-ci ») via les termes du titre + extrait. */
export async function moreLikeIds(id: number, title: string, content: string): Promise<number[]> {
  const idx = await ensureIndex();
  const seed = `${title} ${content.slice(0, 240)}`.trim();
  if (!seed) return [];
  return idx
    .search(seed, { prefix: false, fuzzy: 0.1 })
    .map((r) => Number(r.id))
    .filter((rid) => rid !== id);
}
