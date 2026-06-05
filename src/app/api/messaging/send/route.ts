import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { recordAudit } from "@/lib/audit/audit-store";
import { jsonError } from "@/lib/api-utils";
import { sendGmailMessage, deleteGmailDraft, type EmailAttachment } from "@/lib/connectors/gmail/gmail-api";
import { paperlessFetchRaw } from "@/lib/paperless";
import { createEmailLink } from "@/lib/messaging/email-ged-link-store";
import { resolveSendAccount } from "@/lib/messaging/sendable-accounts";
import { getAccountWithSecret, getDecryptedPassword } from "@/lib/mail-connector/account-store";
import { sendSmtpMessage } from "@/lib/mail-connector/smtp-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendBody = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  /** Boîte d'envoi choisie (sélecteur « Expéditeur »). Défaut : 1ʳᵉ boîte capable d'envoyer. */
  accountId?: string;
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

  // Boîte d'envoi : Google OU IMAP/SMTP, aucun fournisseur prioritaire.
  const sender = await resolveSendAccount(body.accountId);
  if (!sender)
    return NextResponse.json(
      { error: "Aucun compte mail connecté. Connectez une boîte mail avant d'envoyer un message." },
      { status: 503 },
    );
  if (!sender.canSend)
    return NextResponse.json(
      {
        error: "L'envoi n'est pas configuré pour cette boîte.",
        detail: "Renseignez les paramètres SMTP de la boîte, ou reconnectez le compte.",
        errorType: "send_not_configured",
      },
      { status: 503 },
    );

  try {
    const docIds = Array.isArray(body.attachmentDocIds) ? body.attachmentDocIds.filter((n) => Number.isFinite(n)) : [];
    const gedAttachments = docIds.length ? await buildDocumentAttachments(docIds) : [];
    const localAttachments = sanitizeRawAttachments(body.attachments);
    const attachments = [...gedAttachments, ...localAttachments];

    // Identifiant de message + de fil pour tracer les liaisons GED (best-effort).
    let messageId: string | null = null;
    let threadKey: string | null = body.threadId ?? null;
    let result: unknown;

    if (sender.type === "gmail") {
      const message = await sendGmailMessage(sender.id, body.to, body.subject, body.body ?? "", {
        threadId: body.threadId,
        inReplyTo: body.inReplyTo,
        cc: body.cc,
        bcc: body.bcc,
        html: true,
        attachments: attachments.length ? attachments : undefined,
      });
      result = message;
      messageId = message?.id ?? null;
      threadKey = message?.threadId ?? body.threadId ?? message?.id ?? null;
      if (body.draftId) await deleteGmailDraft(sender.id, body.draftId).catch(() => {});
    } else {
      // IMAP → envoi via SMTP (nodemailer). Mot de passe = celui de l'IMAP.
      const acct = await getAccountWithSecret(sender.id);
      const password = await getDecryptedPassword(sender.id);
      if (!acct || !password) {
        return NextResponse.json(
          { error: "Mot de passe de la boîte manquant. Reconnectez le compte.", errorType: "no_password" },
          { status: 503 },
        );
      }
      const sent = await sendSmtpMessage(acct, password, {
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        subject: body.subject,
        body: body.body ?? "",
        inReplyTo: body.inReplyTo,
        attachments: attachments.length ? attachments : undefined,
      });
      result = sent;
      messageId = sent.id || null;
      threadKey = body.threadId ?? sent.id ?? null;
    }

    // Tracer la liaison mail ↔ documents GED joints (best-effort, n'échoue jamais l'envoi).
    if (docIds.length && threadKey) {
      await Promise.all(
        docIds.map((documentId) =>
          createEmailLink({
            emailId: threadKey!,
            scope: "thread",
            accountId: sender.id,
            target: { kind: "document", documentId },
            source: "user",
          }).catch(() => {}),
        ),
      );
    }

    // Journalisation de l'envoi. Destinataire masqué, jamais le corps.
    await recordAudit({
      action: "mail.send",
      target: body.to.replace(/^(.).*(@.*)$/, "$1***$2"),
      details: `${sender.type} · ${attachments.length} pièce(s) jointe(s)${docIds.length ? `, ${docIds.length} doc GED` : ""}`,
    });

    return NextResponse.json({ ok: true, message: result, messageId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/403|insufficient|scope/i.test(msg)) {
      return NextResponse.json(
        {
          error: "L'envoi n'est pas autorisé pour cette boîte mail.",
          detail: "Reconnectez le compte avec l'autorisation d'envoi, ou vérifiez ses paramètres.",
          errorType: "send_not_allowed",
        },
        { status: 403 },
      );
    }
    if (/auth|535|credential|password|EAUTH/i.test(msg)) {
      return NextResponse.json(
        { error: "Connexion SMTP refusée. Vérifiez l'identifiant et le mot de passe (ou mot de passe d'application).", errorType: "smtp_auth" },
        { status: 502 },
      );
    }
    return jsonError("Envoi impossible", error);
  }
}
