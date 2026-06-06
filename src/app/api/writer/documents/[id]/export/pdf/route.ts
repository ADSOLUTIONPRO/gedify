import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { convertDocxToPdf } from "@/lib/writer/onlyoffice-convert";
import { getGedifyInternalBaseUrl } from "@/lib/writer/onlyoffice-config";
import { getWriterDocument } from "@/lib/writer/writer-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const document = await getWriterDocument(id);
    if (!document) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }

    // URL fetchée PAR ONLYOFFICE → base interne (joignable depuis le conteneur ONLYOFFICE).
    const sourceUrl = `${getGedifyInternalBaseUrl()}/api/writer/documents/${id}/file`;
    const result = await convertDocxToPdf({
      documentId: id,
      documentKey: `${id}-v${document.version}-export`,
      sourceUrl,
      title: document.fileName,
    });

    if (!result.ok || !result.fileUrl) {
      return NextResponse.json(
        {
          ok: false,
          message: result.message,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ ok: true, fileUrl: result.fileUrl });
  } catch (error) {
    return jsonError("Export PDF impossible", error);
  }
}
