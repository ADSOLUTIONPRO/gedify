import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  addSecondaryCorrespondent,
  getSecondaryCorrespondents,
  removeSecondaryCorrespondent,
} from "@/lib/documents/secondary-correspondents-store";
import { resolveClassification } from "@/lib/ai/resolve-classification";
import { getCorrespondents } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function namesFor(ids: number[]): Promise<{ id: number; name: string }[]> {
  if (ids.length === 0) return [];
  const list = (await getCorrespondents({ page_size: 1000 })).results ?? [];
  const byId = new Map(list.map((c) => [Number(c.id), c.name]));
  return ids.map((id) => ({ id, name: byId.get(id) ?? `#${id}` }));
}

/** Liste les correspondants secondaires (id + nom) d'un document. */
export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const ids = await getSecondaryCorrespondents(Number(id));
    return NextResponse.json({ items: await namesFor(ids) });
  } catch (error) {
    return jsonError("Correspondants secondaires indisponibles", error);
  }
}

/**
 * Ajoute (`{ name }`, résout/crée le correspondant sans doublon) ou retire
 * (`{ removeId }`) un correspondant secondaire.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const documentId = Number(id);
    const body = (await request.json().catch(() => ({}))) as { name?: string; removeId?: number };

    let ids: number[];
    if (typeof body.removeId === "number") {
      ids = await removeSecondaryCorrespondent(documentId, body.removeId);
    } else if (body.name?.trim()) {
      const resolved = await resolveClassification({ correspondentName: body.name.trim() });
      if (!resolved.correspondent) {
        return NextResponse.json({ error: "Correspondant introuvable." }, { status: 400 });
      }
      ids = await addSecondaryCorrespondent(documentId, resolved.correspondent.id);
    } else {
      return NextResponse.json({ error: "Paramètre `name` ou `removeId` requis." }, { status: 400 });
    }

    return NextResponse.json({ items: await namesFor(ids) });
  } catch (error) {
    return jsonError("Modification des correspondants impossible", error);
  }
}
