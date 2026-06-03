import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, paperlessProxyError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { deleteDocument, getDocument, updateDocument } from "@/lib/paperless";
import { cleanupDocumentData } from "@/lib/documents/cleanup-document-data";
import { listMailDocumentLinks, updateMailDocumentLink } from "@/lib/messaging/mail-document-links-store";
import { addSuppressedAttachment } from "@/lib/mail-connector/suppressed-attachments-store";
import { readSession } from "@/lib/auth/session";
import type { PaperlessDocumentPatch } from "@/lib/paperless-types";

/**
 * Enregistre une suppression volontaire des pièces jointes mail liées à ce
 * document, pour empêcher leur réimportation automatique ultérieure (§5).
 */
async function suppressLinkedMailAttachments(documentId: number): Promise<number> {
  try {
    const links = (await listMailDocumentLinks()).filter((l) => l.paperlessDocumentId === documentId);
    if (links.length === 0) return 0;
    const session = await readSession();
    for (const link of links) {
      await addSuppressedAttachment({
        messageId: link.mailId,
        threadId: link.threadId,
        attachmentId: link.attachmentId,
        filename: link.filename,
        sizeBytes: link.sizeBytes,
        hash: null,
        paperlessDocumentId: documentId,
        deletedBy: session?.username ?? null,
      });
      await updateMailDocumentLink(link.id, { status: "ignored" }).catch(() => {});
    }
    return links.length;
  } catch {
    return 0;
  }
}

type DocumentRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: DocumentRouteContext) {
  try {
    const { id } = await params;
    const data = await getDocument(id);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Impossible de récupérer le document Gedify", error);
  }
}

export async function PATCH(request: NextRequest, { params }: DocumentRouteContext) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as PaperlessDocumentPatch;
    const data = await updateDocument(id, payload);
    return NextResponse.json(data);
  } catch (error) {
    return paperlessProxyError("Impossible de modifier le document Gedify", error);
  }
}

export async function PUT(request: NextRequest, context: DocumentRouteContext) {
  return PATCH(request, context);
}

export async function DELETE(request: NextRequest, { params }: DocumentRouteContext) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const suppressedAttachments = await suppressLinkedMailAttachments(Number(id));
    await deleteDocument(id);
    const cleanup = await cleanupDocumentData(Number(id));
    return NextResponse.json({ ok: true, documentId: id, cleanup, suppressedAttachments });
  } catch (error) {
    return jsonError("Impossible de supprimer le document", error);
  }
}
