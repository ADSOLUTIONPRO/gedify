import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { uploadAttachmentToPaperless } from "@/lib/mail-connector/paperless-upload";
import { convertDocxToPdf } from "@/lib/writer/onlyoffice-convert";
import {
  getWriterDocument,
  recordPaperlessSend,
} from "@/lib/writer/writer-store";

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

    const conversion = await convertDocxToPdf({
      documentId: id,
      documentKey: `${id}-v${document.version}-send`,
      sourceUrl: `${getPublicBaseUrl()}/api/writer/documents/${id}/file`,
      title: document.fileName,
    });

    if (!conversion.ok || !conversion.fileUrl) {
      return NextResponse.json(
        {
          ok: false,
          message: `Conversion PDF impossible : ${conversion.message}`,
        },
        { status: 200 },
      );
    }

    const pdfResponse = await fetch(conversion.fileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Téléchargement du PDF ONLYOFFICE impossible (HTTP ${pdfResponse.status}).`,
        },
        { status: 200 },
      );
    }
    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

    const pdfFilename = `${(document.title || "courrier").replace(/[^a-zA-Z0-9-_]+/g, "-")}.pdf`;

    const upload = await uploadAttachmentToPaperless(
      pdfFilename,
      "application/pdf",
      pdfBuffer,
      {
        title: document.title,
        correspondent: document.paperlessCorrespondent,
        documentType: document.paperlessDocumentType,
        tags: document.paperlessTags,
        created: new Date().toISOString(),
      },
    );

    if (!upload.ok) {
      return NextResponse.json({ ok: false, message: upload.message }, { status: 200 });
    }

    await recordPaperlessSend(id, upload.taskId);

    return NextResponse.json({
      ok: true,
      taskId: upload.taskId,
      message:
        "Document envoyé à Gedify. L'OCR et le classement sont pris en charge par Gedify.",
    });
  } catch (error) {
    return jsonError("Envoi vers la GED impossible", error);
  }
}
