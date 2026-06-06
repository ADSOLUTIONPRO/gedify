import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch } from "@/lib/paperless";
import {
  isTaxonomyKind,
  KIND_TO_RESOURCE,
  TAXONOMY_NAME_MAX,
  type TaxonomyKind,
} from "@/lib/taxonomies/taxonomy-kinds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TaxoItem = { id: number | string; name?: string; slug?: string };
type ListResp = { results?: TaxoItem[] } | TaxoItem[];

/**
 * POST /api/taxonomies  body: { kind, name }
 * Crée une taxonomie (tag, correspondant, type, dossier) — uniquement sur
 * confirmation explicite côté UI. Refuse les noms vides/trop longs et
 * dédoublonne (insensible à la casse) : si la valeur existe déjà, on la renvoie.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { kind?: unknown; name?: unknown };
    const kind = body.kind;
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!isTaxonomyKind(kind)) {
      return NextResponse.json({ ok: false, message: "kind invalide." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ ok: false, message: "Nom vide." }, { status: 400 });
    }
    if (name.length > TAXONOMY_NAME_MAX) {
      return NextResponse.json(
        { ok: false, message: `Nom trop long (max ${TAXONOMY_NAME_MAX} caractères).` },
        { status: 400 },
      );
    }
    const resource = KIND_TO_RESOURCE[kind as TaxonomyKind];

    // Anti-doublon (insensible à la casse) : on réutilise l'existant si présent.
    const existingRaw = await paperlessFetch<ListResp>(`/api/${resource}/`, {
      searchParams: { name__iexact: name, page_size: "1" },
    });
    const existingList = Array.isArray(existingRaw) ? existingRaw : existingRaw.results ?? [];
    const dup = existingList.find((i) => String(i.name ?? "").toLowerCase() === name.toLowerCase());
    if (dup) {
      return NextResponse.json({ ok: true, id: dup.id, kind, name: String(dup.name), existed: true });
    }

    const created = await paperlessFetch<TaxoItem>(`/api/${resource}/`, {
      method: "POST",
      body: { name },
    });
    return NextResponse.json({
      ok: true,
      id: created?.id ?? null,
      kind,
      name: String(created?.name ?? name),
      slug: created?.slug ?? null,
      existed: false,
    });
  } catch (error) {
    return jsonError("Création de taxonomie impossible.", error);
  }
}
