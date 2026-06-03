import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { sendGmailMessage, deleteGmailDraft, type EmailAttachment } from "@/lib/connectors/gmail/gmail-api";
import { paperlessFetchRaw } from "@/lib/paperless";
import { createEmailLink } from "@/lib/messaging/email-ged-link-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendBody = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  draftId?: string;
  /** Documents GED à joindre (récupérés côté serveur depuis Gedify). */
  attachmentDocIds?: number[];
  /** Fichiers locaux déjà encodés côté client (importés dans la GED en parallèle). */
  attachments?: EmailAttachment[];
};

/** Ne garde que des pièces jointes locales valides (filename + base64 non vide). */
function sanitizeRawAttachments(input: unknown): EmailAttachment[] {
  if (!Array.isArray(input)) return [];
  const out: EmailAttachment[] = [];
  for (const a of input) {
    if (!a || typeof a !== "object") continue;
    const { filename, mimeType, contentBase64 } = a as Partial<EmailAttachment>;
    if (typeof filename !== "string" || typeof contentBase64 !== "string" || !contentBase64) continue;
    out.push({ filename, mimeType: typeof mimeType === "string" && mimeType ? mimeType : "application/octet-stream", contentBase64 });
  }
  return out;
}

/** Récupère les octets des documents Gedify et les prépare en pièces jointes. */
async function buildDocumentAttachments(docIds: number[]): Promise<EmailAttachment[]> {
  const out: EmailAttachment[] = [];
  for (const id of docIds) {
    try {
      const res = await paperlessFetchRaw(`/api/documents/${id}/download/`, {
        headers: { Accept: "application/pdf,application/octet-stream,*/*" },
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
      const filename = match ? decodeURIComponent(match[1].trim()) : `document-${id}.pdf`;
      const mimeType = (res.headers.get("content-type") ?? "application/pdf").split(";")[0].trim() || "application/pdf";
      out.push({ filename, mimeType, contentBase64: buf.toString("base64") });
    } catch {
      /* on saute la pièce jointe en échec plutôt que d'échouer tout l'envoi */
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!body.to || !body.subject) {
    return NextResponse.json({ error: "to et subject requis." }, { status: 400 });
  }

  const account = await getActiveGmailAccount();
  if (!account) return NextResponse.json({ error: "Aucun compte Gmail connecté." }, { status: 503 });

  try {
    const docIds = Array.isArray(body.attachmentDocIds) ? body.attachmentDocIds.filter((n) => Number.isFinite(n)) : [];
    const gedAttachments = docIds.length ? await buildDocumentAttachments(docIds) : [];
    const localAttachments = sanitizeRawAttachments(body.attachments);
    const attachments = [...gedAttachments, ...localAttachments];

    const message = await sendGmailMessage(account.accountId, body.to, body.subject, body.body ?? "", {
      threadId: body.threadId,
      inReplyTo: body.inReplyTo,
      cc: body.cc,
      bcc: body.bcc,
      html: true,
      attachments: attachments.length ? attachments : undefined,
    });

    // Supprimer le brouillon associé s'il existe
    if (body.draftId) {
      await deleteGmailDraft(account.accountId, body.draftId).catch(() => {});
    }

    // Tracer la liaison mail ↔ documents GED joints (best-effort, n'échoue jamais l'envoi).
    if (docIds.length && message?.id) {
      const threadId = message.threadId ?? body.threadId ?? message.id;
      await Promise.all(
        docIds.map((documentId) =>
          createEmailLink({
            emailId: threadId,
            scope: "thread",
            accountId: account.accountId,
            target: { kind: "document", documentId },
            source: "user",
          }).catch(() => {}),
        ),
      );
    }

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    // Distinguer l'erreur de scope manquant
    const msg = error instanceof Error ? error.message : String(error);
    if (/403|insufficient/i.test(msg)) {
      return NextResponse.json(
        {
          error: "Scope Gmail insuffisant pour envoyer des emails.",
          detail: "Reconnectez votre compte Gmail avec le scope gmail.send activé.",
          errorType: "gmail_scope",
        },
        { status: 403 },
      );
    }
    return jsonError("Erreur envoi Gmail", error);
  }
}
