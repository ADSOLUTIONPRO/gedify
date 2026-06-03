import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  deleteWriterDocument,
  getWriterDocument,
  updateWriterDocument,
} from "@/lib/writer/writer-store";
import type { WriterDocumentInput } from "@/lib/writer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const document = await getWriterDocument(id);
    if (!document) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (error) {
    return jsonError("Impossible de récupérer le document", error);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json()) as WriterDocumentInput;
    const updated = await updateWriterDocument(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }
    return NextResponse.json({ document: updated });
  } catch (error) {
    return jsonError("Impossible de modifier le document", error);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const ok = await deleteWriterDocument(id);
    if (!ok) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError("Impossible de supprimer le document", error);
  }
}
