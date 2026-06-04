import "server-only";

import type { NextRequest } from "next/server";
import path from "node:path";
import {
  readStore,
  readOriginal,
  readPage,
  savePage,
  STORE,
  type EngineDocument,
} from "@/lib/engine/stores";
import { makePage } from "@/lib/engine/previews";

/* Rendu d'UNE page d'un document (visualiseur multi-pages) : sert
   files/pages/<id>/<n>.webp, la rend une fois à la demande si absente.
   Cacheable (ETag + 304). Jamais l'original chargé côté grille. */

type Context = { params: Promise<{ id: string; n: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest, context: Context) {
  const { id: idStr, n: nStr } = await context.params;
  const id = Number(idStr);
  const n = Number(nStr);
  if (!Number.isFinite(id) || !Number.isFinite(n) || n < 1) {
    return new Response("Paramètres invalides.", { status: 400 });
  }

  let page = await readPage(id, n);
  if (!page) {
    const docs = await readStore<EngineDocument[]>(STORE.documents, []);
    const doc = docs.find((d) => d.id === id && !d.deleted);
    if (!doc) return new Response("Document introuvable.", { status: 404 });
    const orig = await readOriginal(doc.storedFilename);
    if (!orig) return new Response("Fichier introuvable.", { status: 404 });
    const made = await makePage(orig, doc.mime_type ?? "", path.extname(doc.storedFilename), n);
    if (!made) return new Response("Page indisponible.", { status: 404 });
    await savePage(id, n, made);
    page = made;
  }

  const etag = `"pg-${id}-${n}-${page.length}"`;
  const cache = "private, max-age=3600, must-revalidate";
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cache } });
  }
  return new Response(new Uint8Array(page), {
    status: 200,
    headers: { "Content-Type": "image/webp", "Cache-Control": cache, ETag: etag },
  });
}
