import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { createPaperlessObject, updateDocument } from "@/lib/paperless";
import type { PaperlessCorrespondent } from "@/lib/paperless-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
type Body = { name: string };

/**
 * Crée un NOUVEAU correspondant dans la GED puis l'applique au document
 * ([id] = documentId). Le nom peut être édité par l'utilisateur avant création.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const documentId = Number(id);
    const body = (await request.json()) as Body;
    const name = (body.name ?? "").trim();
    if (!Number.isFinite(documentId) || !name) {
      return NextResponse.json({ error: "documentId / nom requis." }, { status: 400 });
    }

    const created = await createPaperlessObject<PaperlessCorrespondent>("/api/correspondents/", { name });
    const correspondentId = Number(created.id);
    const document = await updateDocument(documentId, { correspondent: correspondentId });
    return NextResponse.json({ ok: true, correspondent: created, document });
  } catch (error) {
    return jsonError("Création du correspondant impossible", error);
  }
}
