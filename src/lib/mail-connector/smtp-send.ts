import "server-only";

import nodemailer from "nodemailer";
import type { MailAccount } from "./types";
import type { EmailAttachment } from "@/lib/connectors/gmail/gmail-api";

/* Envoi d'un message via le SMTP d'un compte IMAP (nodemailer). Le mot de passe
   SMTP réutilise par défaut celui de l'IMAP (cas courant des fournisseurs).
   Aucun secret n'est loggé. */

export type SmtpSendInput = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  attachments?: EmailAttachment[];
};

export type SmtpSendResult = { id: string; accepted: string[] };

/** Authentification SMTP : mot de passe (basique) ou XOAUTH2 (OAuth2, Outlook). */
type SmtpAuth =
  | { kind: "password"; password: string }
  | { kind: "oauth2"; accessToken: string };

export async function sendSmtpMessage(
  account: MailAccount,
  password: string,
  msg: SmtpSendInput,
): Promise<SmtpSendResult> {
  return sendSmtp(account, { kind: "password", password }, msg);
}

/** Envoi SMTP via XOAUTH2 (compte Microsoft/Outlook en authentification moderne). */
export async function sendSmtpMessageOAuth2(
  account: MailAccount,
  accessToken: string,
  msg: SmtpSendInput,
): Promise<SmtpSendResult> {
  return sendSmtp(account, { kind: "oauth2", accessToken }, msg);
}

async function sendSmtp(
  account: MailAccount,
  auth: SmtpAuth,
  msg: SmtpSendInput,
): Promise<SmtpSendResult> {
  const host = account.smtpHost?.trim();
  if (!host) throw new Error("Serveur SMTP non configuré pour cette boîte.");
  const port = account.smtpPort ?? 465;
  const enc = account.smtpEncryption ?? "tls";
  const user = account.smtpUsername || account.username || account.email;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: enc === "tls", // 465 = SSL/TLS direct ; 587 = STARTTLS (secure:false)
    requireTLS: enc === "starttls",
    auth:
      auth.kind === "oauth2"
        ? { type: "OAuth2", user, accessToken: auth.accessToken }
        : { user, pass: auth.password },
  });

  const attachments = (msg.attachments ?? []).map((a) => ({
    filename: a.filename,
    content: Buffer.from(a.contentBase64, "base64"),
    contentType: a.mimeType,
  }));

  const isHtml = /<[a-z][\s\S]*>/i.test(msg.body);
  const info = await transporter.sendMail({
    from: account.email,
    to: msg.to,
    cc: msg.cc || undefined,
    bcc: msg.bcc || undefined,
    subject: msg.subject,
    ...(isHtml ? { html: msg.body, text: msg.body.replace(/<[^>]+>/g, " ") } : { text: msg.body }),
    inReplyTo: msg.inReplyTo || undefined,
    attachments,
  });

  return { id: info.messageId ?? "", accepted: (info.accepted ?? []).map(String) };
}
