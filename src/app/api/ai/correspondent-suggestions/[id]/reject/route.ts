import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Rejette la suggestion de correspondant pour ce document ([id] = documentId).
 * Les suggestions étant déduites à la volée (non persistées), le rejet est un
 * accusé de réception : aucune mutation Gedify. La correspondance retenue
 * par l'utilisateur reste prioritaire côté UI.
 */
export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const documentId = Number(id);
    if (!Number.isFinite(documentId)) {
      return NextResponse.json({ error: "documentId invalide." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, documentId, rejected: true });
  } catch (error) {
    return jsonError("Rejet impossible", error);
  }
}
