import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { convertDocxToPdf } from "@/lib/writer/onlyoffice-convert";
import { getWriterDocument } from "@/lib/writer/writer-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function getPublicBaseUrl(): string {
  return (
    process.env.APP_PUBLIC_URL?.replace(/\/+$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "http://localhost:3000"
  );
}

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const document = await getWriterDocument(id);
    if (!document) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }

    const sourceUrl = `${getPublicBaseUrl()}/api/writer/documents/${id}/file`;
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
