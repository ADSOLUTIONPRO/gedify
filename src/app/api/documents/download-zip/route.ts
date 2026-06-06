import "server-only";

import type { NextRequest } from "next/server";
import JSZip from "jszip";
import { readStore, readOriginal, STORE, type EngineDocument } from "@/lib/engine/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/documents/download-zip?ids=1,2,3
 * Construit un .zip des fichiers originaux des documents demandés (sélection
 * multiple). Auth gérée par le middleware. Noms de fichiers dédoublonnés.
 */
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));
  if (ids.length === 0) return new Response("Aucun document.", { status: 400 });

  const docs = await readStore<EngineDocument[]>(STORE.documents, []);
  const byId = new Map(docs.map((d) => [d.id, d]));

  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;
  for (const id of ids) {
    const doc = byId.get(id);
    if (!doc || doc.deleted) continue;
    const buf = await readOriginal(doc.storedFilename).catch(() => null);
    if (!buf) continue;
    let name = doc.original_file_name || `document-${id}`;
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      name = dot > 0 ? `${name.slice(0, dot)}-${id}${name.slice(dot)}` : `${name}-${id}`;
    }
    used.add(name);
    zip.file(name, buf);
    added += 1;
  }
  if (added === 0) return new Response("Aucun fichier disponible.", { status: 404 });

  const content = await zip.generateAsync({ type: "nodebuffer" });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="documents-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
