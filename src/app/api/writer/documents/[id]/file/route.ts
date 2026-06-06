import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { verifyDocAccessToken } from "@/lib/writer/onlyoffice-config";
import {
  getWriterDocument,
  readWriterDocumentFile,
} from "@/lib/writer/writer-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;

    // Si appelé par ONLYOFFICE (oo_token présent), on vérifie le jeton signé
    // (le middleware a laissé passer sans session). Sans oo_token, la session a
    // déjà été validée par le middleware (téléchargement depuis le navigateur).
    const ooToken = request.nextUrl.searchParams.get("oo_token");
    if (ooToken && !(await verifyDocAccessToken(ooToken, id, "file"))) {
      console.warn(`[ONLYOFFICE] /file docId=${id} : oo_token invalide → 401`);
      return NextResponse.json({ error: "Jeton d'accès invalide" }, { status: 401 });
    }

    const document = await getWriterDocument(id);
    if (!document) {
      console.warn(`[ONLYOFFICE] /file docId=${id} : document introuvable → 404`);
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }
    const buffer = await readWriterDocumentFile(id);
    if (!buffer) {
      console.warn(`[ONLYOFFICE] /file docId=${id} : fichier introuvable → 404`);
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
