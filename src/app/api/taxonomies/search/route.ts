import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch } from "@/lib/paperless";
import { isTaxonomyKind, KIND_TO_RESOURCE, type TaxonomyKind } from "@/lib/taxonomies/taxonomy-kinds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TaxoItem = { id: number | string; name?: string; slug?: string };
type ListResp = { results?: TaxoItem[] } | TaxoItem[];

/**
 * GET /api/taxonomies/search?kind=tag&q=imp
 * Recherche des taxonomies existantes (tags, correspondants, types, dossiers).
 * Passe par le moteur (filtre `name__icontains`) → compatible SQLite/Postgres/JSON.
 */
export async function GET(req: NextRequest) {
  try {
    const kind = req.nextUrl.searchParams.get("kind") ?? "";
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!isTaxonomyKind(kind)) {
      return NextResponse.json({ ok: false, message: "kind invalide." }, { status: 400 });
    }
    const resource = KIND_TO_RESOURCE[kind as TaxonomyKind];

    const params: Record<string, string> = { page_size: "20", ordering: "name" };
    if (q) params.name__icontains = q;
    const raw = await paperlessFetch<ListResp>(`/api/${resource}/`, { searchParams: params });
    const list = Array.isArray(raw) ? raw : raw.results ?? [];

    const items = list
      .filter((i) => typeof i?.name === "string" && i.name.trim())
      .slice(0, 20)
      .map((i) => ({ id: i.id, kind, name: String(i.name), slug: i.slug ?? null }));

    // Peut-on proposer la création ? (oui si la saisie ne correspond pas exactement)
    const exact = q ? items.some((i) => i.name.toLowerCase() === q.toLowerCase()) : true;
    return NextResponse.json({ ok: true, items, canCreate: q.length > 0 && !exact });
  } catch (error) {
    return jsonError("Recherche de taxonomie impossible.", error);
  }
}
