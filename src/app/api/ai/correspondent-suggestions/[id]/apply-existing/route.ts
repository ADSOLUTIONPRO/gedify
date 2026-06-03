import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { updateDocument } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
type Body = { correspondentId: number };

/** Applique un correspondant EXISTANT au document ([id] = documentId). */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const documentId = Number(id);
    const body = (await request.json()) as Body;
    const correspondentId = Number(body.correspondentId);
    if (!Number.isFinite(documentId) || !Number.isFinite(correspondentId)) {
      return NextResponse.json({ error: "documentId / correspondentId invalides." }, { status: 400 });
    }
    const document = await updateDocument(documentId, { correspondent: correspondentId });
    return NextResponse.json({ ok: true, document });
  } catch (error) {
    return jsonError("Application du correspondant impossible", error);
  }
}
