import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getCorrespondents, getDocumentTypes, getDocuments } from "@/lib/paperless";
import { getNameById } from "@/lib/document-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recherche compacte de documents GED (pour le picker « Joindre depuis la GED »). */
export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const correspondentId = sp.get("correspondent");
  const typeId = sp.get("document_type");

  try {
    const params: Record<string, string | number> = { page: 1, page_size: 25, ordering: "-added" };
    if (q) params.query = q;
    if (correspondentId) params.correspondent__id = correspondentId;
    if (typeId) params.document_type__id = typeId;

    const [docs, corr, types] = await Promise.all([getDocuments(params), getCorrespondents(), getDocumentTypes()]);
    const correspondents = corr.results ?? [];
    const documentTypes = types.results ?? [];

    const results = (docs.results ?? []).map((d) => ({
      id: Number(d.id),
      title: d.title || `Document #${d.id}`,
      correspondent: d.correspondent__name ?? getNameById(correspondents, d.correspondent) ?? null,
      type: d.document_type__name ?? getNameById(documentTypes, d.document_type) ?? null,
      created: d.created ?? null,
      thumbUrl: `/api/paperless/documents/${d.id}/thumb`,
    }));

    return NextResponse.json({ results, count: docs.count ?? results.length });
  } catch (error) {
    return jsonError("Recherche de documents impossible", error);
  }
}
