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
import { sendSmtpMessage, sendSmtpMessageOAuth2 } from "@/lib/mail-connector/smtp-send";
import { getValidOutlookAccessToken } from "@/lib/connectors/outlook/outlook-access";

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

type BuiltAttachment = EmailAttachment & { documentId: number; size: number };
type AttachmentFailure = { documentId: number; error: string };

/**
 * Récupère les OCTETS RÉELS des documents Gedify (fichier original) et les
 * prépare en pièces jointes. Remonte chaque échec (jamais de skip silencieux)
 * et déduplique les noms identiques (facture.pdf → facture (1).pdf).
 */
async function buildDocumentAttachments(docIds: number[]): Promise<{ attachments: BuiltAttachment[]; failures: AttachmentFailure[] }> {
  const attachments: BuiltAttachment[] = [];
  const failures: AttachmentFailure[] = [];
  const usedNames = new Map<string, number>();
  for (const id of docIds) {
    try {
      const res = await paperlessFetchRaw(`/api/documents/${id}/download/`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) { failures.push({ documentId: id, error: "attachment_empty" }); continue; }
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
      let filename = match ? decodeURIComponent(match[1].trim()) : `document-${id}.pdf`;
      // Anti-collision : un même nom n'écrase jamais une autre pièce jointe.
      const lower = filename.toLowerCase();
      const seen = usedNames.get(lower) ?? 0;
      if (seen > 0) {
        const dot = filename.lastIndexOf(".");
        filename = dot > 0 ? `${filename.slice(0, dot)} (${seen})${filename.slice(dot)}` : `${filename} (${seen})`;
      }
      usedNames.set(lower, seen + 1);
      const mimeType = (res.headers.get("content-type") ?? "application/pdf").split(";")[0].trim() || "application/pdf";
      attachments.push({ filename, mimeType, contentBase64: buf.toString("base64"), documentId: id, size: buf.length });
    } catch (e) {
      failures.push({ documentId: id, error: e instanceof Error ? e.message : "attachment_read_failed" });
    }
  }
  return { attachments, failures };
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
    const { attachments: gedAttachments, failures } = docIds.length
      ? await buildDocumentAttachments(docIds)
      : { attachments: [] as BuiltAttachment[], failures: [] as AttachmentFailure[] };

    // Ne JAMAIS envoyer silencieusement un mail sans une pièce jointe demandée :
    // si un document GED ne peut pas être récupéré, on bloque l'envoi.
    if (failures.length > 0) {
      console.error(`[mail:send] pièces jointes introuvables: ${failures.map((f) => `doc ${f.documentId} (${f.error})`).join(", ")}`);
      return NextResponse.json(
        {
          error: "attachment_not_found",
          errorType: "attachment_not_found",
          message: `Envoi annulé : ${failures.length} document(s) n'ont pas pu être joints (fichier original introuvable). Retirez-les ou réessayez.`,
          failedAttachments: failures,
        },
        { status: 422 },
      );
    }

    const localAttachments = sanitizeRawAttachments(body.attachments);
    const attachments: EmailAttachment[] = [...gedAttachments, ...localAttachments];
    console.log(`[mail:send] ${attachments.length} pièce(s) jointe(s) (${docIds.length} doc GED), total ${gedAttachments.reduce((s, a) => s + a.size, 0)} octets`);

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
      // IMAP/SMTP. Compte Outlook OAuth → XOAUTH2 ; sinon mot de passe SMTP.
      const acct = await getAccountWithSecret(sender.id);
      if (!acct) {
        return NextResponse.json(
          { error: "Boîte d'envoi introuvable. Reconnectez le compte.", errorType: "no_password" },
          { status: 503 },
        );
      }
      const smtpInput = {
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        subject: body.subject,
        body: body.body ?? "",
        inReplyTo: body.inReplyTo,
        attachments: attachments.length ? attachments : undefined,
      };
      let sent;
      if (acct.authType === "oauth-outlook") {
        const { accessToken } = await getValidOutlookAccessToken(sender.id);
        sent = await sendSmtpMessageOAuth2(acct, accessToken, smtpInput);
      } else {
        const password = await getDecryptedPassword(sender.id);
        if (!password) {
          return NextResponse.json(
            { error: "Mot de passe de la boîte manquant. Reconnectez le compte.", errorType: "no_password" },
            { status: 503 },
          );
        }
        sent = await sendSmtpMessage(acct, password, smtpInput);
      }
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

    return NextResponse.json({
      ok: true,
      message: result,
      messageId,
      attachmentCount: attachments.length,
      attachments: gedAttachments.map((a) => ({ documentId: a.documentId, filename: a.filename, size: a.size, attached: true })),
    });
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
