import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getDocuments, getTags } from "@/lib/paperless";
import { buildDocumentApiParams } from "@/lib/documents/document-list-loader";
import { isDocumentArchived, isDocumentToProcess } from "@/lib/document-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/documents/ids?<mêmes filtres que la liste>&tab=...
 * Renvoie TOUS les ID de documents correspondant au filtre courant (toutes pages),
 * pour la sélection « tout sélectionner (la totalité) ». Ne renvoie que des ID.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const tab = sp.get("tab") ?? "";
    const params: Record<string, string> = {};
    for (const k of ["query", "correspondent", "document_type", "tag", "created_from", "added_from", "asn", "ordering"]) {
      const v = sp.get(k);
      if (v) params[k] = v;
    }
    // page_size très large → toutes les correspondances en un appel.
    const apiParams = buildDocumentApiParams(params, tab, 100000);
    const data = await getDocuments(apiParams);
    let docs = data.results ?? [];

    // Filtres d'onglet appliqués comme dans la page liste.
    if (tab === "a-traiter") {
      const tags = (await getTags()).results ?? [];
      docs = docs.filter((d) => isDocumentToProcess(d, tags));
    } else if (tab === "archives") {
      docs = docs.filter(isDocumentArchived);
    }

    const ids = docs.map((d) => Number(d.id)).filter((n) => Number.isFinite(n));
    return NextResponse.json({ ok: true, ids, count: ids.length });
  } catch (error) {
    return jsonError("Récupération des identifiants de documents impossible", error);
  }
}
