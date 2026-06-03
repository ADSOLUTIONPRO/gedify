import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { getGmailAttachment } from "@/lib/connectors/gmail/gmail-api";
import { findExistingLink, createMailDocumentLink } from "@/lib/messaging/mail-document-links-store";
import { paperlessFetch } from "@/lib/paperless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportBody = {
  mailId: string;
  threadId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
};

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!body.mailId || !body.attachmentId || !body.filename) {
    return NextResponse.json({ error: "mailId, attachmentId et filename requis." }, { status: 400 });
  }

  // Vérifier doublon
  const existing = await findExistingLink(body.mailId, body.attachmentId);
  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyImported: true,
      link: existing,
    });
  }

  const account = await getActiveGmailAccount();
  if (!account) {
    return NextResponse.json({ error: "Aucun compte Gmail connecté." }, { status: 503 });
  }

  // Créer le lien "pending"
  const link = await createMailDocumentLink({
    accountId: account.accountId,
    mailId: body.mailId,
    threadId: body.threadId,
    attachmentId: body.attachmentId,
    filename: body.filename,
    mimeType: body.mimeType,
    sizeBytes: body.sizeBytes ?? null,
    paperlessDocumentId: null,
    documentTitle: null,
    status: "pending",
    errorMessage: null,
  });

  try {
    // Télécharger la pièce jointe depuis Gmail
    const attachment = await getGmailAttachment(account.accountId, body.mailId, body.attachmentId);

    // Décoder le base64url en buffer
    const base64 = attachment.data.replace(/-/g, "+").replace(/_/g, "/");
    const buffer = Buffer.from(base64, "base64");

    // Uploader vers la GED via l'API consume
    const formData = new FormData();
    formData.append(
      "document",
      new Blob([buffer], { type: body.mimeType }),
      body.filename,
    );

    const uploadResult = await paperlessFetch<{ task_id?: string } | null>("/api/documents/post_document/", {
      method: "POST",
      body: formData as unknown as Record<string, unknown>,
    });

    const taskId = uploadResult?.task_id ?? null;

    // Best-effort : résoudre l'ID du document Gedify créé (consommation async)
    // pour rendre « Ajouté à la GED » cliquable. On sonde la file de tâches quelques secondes.
    let documentId: number | null = null;
    if (taskId) {
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        try {
          const tasks = await paperlessFetch<Array<{ status?: string; related_document?: number | string | null }>>(
            `/api/tasks/?task_id=${encodeURIComponent(taskId)}`,
          );
          const task = Array.isArray(tasks) ? tasks[0] : null;
          if (task?.related_document) { documentId = Number(task.related_document); break; }
          if (task?.status && /FAILURE/i.test(task.status)) break;
        } catch {
          /* on garde documentId = null */
        }
      }
    }

    // Mettre à jour le lien avec le statut importé (+ documentId si résolu)
    const { updateMailDocumentLink } = await import("@/lib/messaging/mail-document-links-store");
    const updated = await updateMailDocumentLink(link.id, {
      status: "imported",
      documentTitle: body.filename,
      paperlessDocumentId: documentId,
      errorMessage: null,
    });

    return NextResponse.json({
      ok: true,
      alreadyImported: false,
      link: updated ?? link,
      taskId,
    });
  } catch (error) {
    const { updateMailDocumentLink } = await import("@/lib/messaging/mail-document-links-store");
    await updateMailDocumentLink(link.id, {
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return jsonError("Erreur lors de l'import de la pièce jointe", error);
  }
}
