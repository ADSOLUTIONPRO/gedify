import "server-only";

import type { NextRequest } from "next/server";
import path from "node:path";
import {
  readStore,
  readOriginal,
  readPreview,
  savePreview,
  STORE,
  type EngineDocument,
} from "@/lib/engine/stores";
import { makePreview } from "@/lib/engine/previews";

/* Aperçu image (moyenne résolution) d'un document : sert files/previews/<id>.webp,
   le génère une fois à la demande si absent, et se rabat sur la miniature sinon.
   Cacheable (ETag + revalidation) comme les miniatures. */

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: Context) {
  const { id: idStr } = await context.params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return new Response("Identifiant invalide.", { status: 400 });

  let preview = await readPreview(id);
  if (!preview) {
    const docs = await readStore<EngineDocument[]>(STORE.documents, []);
    const doc = docs.find((d) => d.id === id && !d.deleted);
    if (!doc) return new Response("Document introuvable.", { status: 404 });
    const orig = await readOriginal(doc.storedFilename);
    if (orig) {
      const made = await makePreview(orig, doc.mime_type ?? "", path.extname(doc.storedFilename));
      if (made) {
        await savePreview(id, made);
        preview = made;
      }
    }
  }

  // Pas d'aperçu possible → on renvoie la miniature (toujours disponible).
  if (!preview) {
    return Response.redirect(new URL(`/api/paperless/documents/${id}/thumb`, request.url), 302);
  }

  const etag = `"p-${id}-${preview.length}"`;
  const cache = "private, max-age=3600, must-revalidate";
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cache } });
  }
  return new Response(new Uint8Array(preview), {
    status: 200,
    headers: { "Content-Type": "image/webp", "Cache-Control": cache, ETag: etag },
  });
}
