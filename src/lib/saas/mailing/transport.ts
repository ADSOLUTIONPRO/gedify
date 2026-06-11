import "server-only";

import { getSmtpConfig, requireMailingReady, type SmtpConfig } from "./config";

/* Transport SMTP via nodemailer (chargé paresseusement). Aucun secret loggé. */

export type SendResult = { messageId: string; accepted: string[]; rejected: string[] };

export type SendInput = {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text?: string | null;
  replyTo?: string | null;
};

async function buildTransporter(cfg: SmtpConfig) {
  const nodemailer = (await import("nodemailer")).default;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: !cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

function fromHeader(cfg: SmtpConfig): string {
  return cfg.fromName ? `"${cfg.fromName.replace(/"/g, "")}" <${cfg.fromEmail}>` : cfg.fromEmail;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Envoie un email via le SMTP configuré. Lève si le mailing n'est pas prêt. */
export async function sendEmail(input: SendInput): Promise<SendResult> {
  const cfg = requireMailingReady();
  const transporter = await buildTransporter(cfg);
  const info = await transporter.sendMail({
    from: fromHeader(cfg),
    to: input.toName ? `"${input.toName.replace(/"/g, "")}" <${input.to}>` : input.to,
    subject: input.subject,
    html: input.html,
    text: input.text || htmlToText(input.html),
    replyTo: input.replyTo || undefined,
  });
  return {
    messageId: info.messageId ?? "",
    accepted: (info.accepted ?? []).map(String),
    rejected: (info.rejected ?? []).map(String),
  };
}

/** Vérifie la connexion SMTP (verify). Ne révèle aucun secret. */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getSmtpConfig();
  if (!cfg) return { ok: false, error: "Configuration SMTP incomplète." };
  try {
    const transporter = await buildTransporter(cfg);
    await transporter.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec de la connexion SMTP." };
  }
}
