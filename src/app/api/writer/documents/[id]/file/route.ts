import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  getWriterDocument,
  readWriterDocumentFile,
} from "@/lib/writer/writer-store";

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
    const buffer = await readWriterDocumentFile(id);
    if (!buffer) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }
    return new Response(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": document.contentType,
        "Content-Disposition": `inline; filename="${document.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError("Impossible de servir le fichier", error);
  }
}
