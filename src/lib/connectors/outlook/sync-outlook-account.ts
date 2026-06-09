import "server-only";

import { getAccountWithSecret, recordAccountSyncResult } from "@/lib/mail-connector/account-store";
import { appendLog } from "@/lib/mail-connector/log-store";
import { evaluateAttachment, evaluateFolder, evaluateSender } from "@/lib/mail-connector/mail-filter-engine";
import type { MailContextLite } from "@/lib/mail-connector/mail-filter-types";
import { uploadAttachmentToPaperless } from "@/lib/mail-connector/paperless-upload";
import { buildOutcome, findMatchingRule, type MailContext } from "@/lib/mail-connector/rule-engine";
import { listRules } from "@/lib/mail-connector/rule-store";
import type { MailSyncResult } from "@/lib/mail-connector/types";
import { upsertEmailMessage } from "@/lib/messaging/email-message-store";
import { getValidOutlookAccessToken } from "./outlook-access";
import { getMessageAttachments, listMessages, markMessageRead, deleteMessage } from "./graph-api";

/* Relève d'un compte Microsoft via Graph : lit l'INBOX (ou le dossier
   surveillé), importe les pièces jointes dans la GED (mêmes filtres/règles que
   l'IMAP) et indexe les messages pour la boîte de réception. Aucune dépendance
   IMAP/SMTP. */

const REASON_LABEL: Record<string, string> = {
  "folder-excluded": "Dossier exclu",
  "sender-blocked": "Expéditeur bloqué",
  "domain-blocked": "Domaine expéditeur bloqué",
  "sender-not-allowed": "Expéditeur hors liste autorisée",
  "domain-not-allowed": "Domaine hors liste autorisée",
  "extension-blocked": "Extension de pièce jointe bloquée",
  "extension-not-allowed": "Extension non autorisée par le filtre",
  "name-pattern-blocked": "Nom de pièce jointe filtré",
  "size-too-small": "Pièce jointe trop petite",
  "size-too-large": "Pièce jointe trop volumineuse",
  "attachment-inline": "Pièce jointe inline ignorée",
  "rule-ignored": "Ignoré par règle utilisateur",
  "no-attachment": "Aucune pièce jointe compatible",
};

function emptyResult(accountId: string, ok: boolean, message: string, durationMs = 0): MailSyncResult {
  return { accountId, ok, imported: 0, ignored: 0, errors: ok ? 0 : 1, duplicates: 0, durationMs, message, logIds: [] };
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot + 1).toLowerCase();
}

export async function syncOutlookAccount(accountId: string): Promise<MailSyncResult> {
  const started = Date.now();
  const account = await getAccountWithSecret(accountId);
  if (!account) return emptyResult(accountId, false, "Compte introuvable.");
  if (!account.isActive) return emptyResult(accountId, false, "Compte désactivé.");
  if (account.authType !== "oauth-outlook") return emptyResult(accountId, false, "Compte non Microsoft.");

  let accessToken: string;
  try {
    ({ accessToken } = await getValidOutlookAccessToken(accountId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token Microsoft indisponible — reconnectez le compte.";
    await recordAccountSyncResult(accountId, { ok: false, errorMessage: msg });
    return emptyResult(accountId, false, msg, Date.now() - started);
  }

  const folderDecision = evaluateFolder(account.watchedFolder, account.folderRules);
  if (!folderDecision.allow) {
    const msg = REASON_LABEL[folderDecision.reason ?? "folder-excluded"];
    await recordAccountSyncResult(accountId, { ok: false, errorMessage: msg });
    return emptyResult(accountId, false, msg, Date.now() - started);
  }

  const rules = await listRules();
  let imported = 0;
  let ignored = 0;
  let errors = 0;
  const logIds: string[] = [];

  try {
    const messages = await listMessages(accessToken, {
      folder: account.watchedFolder,
      top: 30,
      unreadOnly: account.ignoreAlreadyRead,
    });

    for (const message of messages) {
      const fromAddress = message.from?.emailAddress?.address ?? null;
      const toAddress = (message.toRecipients ?? []).map((r) => r.emailAddress?.address).filter(Boolean).join(", ") || null;
      const subject = message.subject ?? null;

      // Index plein-texte (recherche assistant + boîte de réception GEDify).
      void upsertEmailMessage({
        id: `${account.id}:${message.id}`,
        accountId: account.id,
        uid: message.id,
        messageId: message.internetMessageId ?? null,
        from: fromAddress,
        to: toAddress,
        subject,
        date: message.receivedDateTime ?? null,
        text: message.bodyPreview ?? "",
        hasAttachments: Boolean(message.hasAttachments),
      }).catch(() => {});

      const senderDecision = evaluateSender(fromAddress, account.senderFilter);
      if (!senderDecision.allow) {
        const log = await appendLog({ accountId: account.id, accountName: account.name, emailUid: message.id, messageId: message.internetMessageId ?? null, from: fromAddress, subject, attachmentName: null, status: "ignored", paperlessDocumentId: null, appliedRuleId: null, errorMessage: REASON_LABEL[senderDecision.reason ?? "sender-blocked"], durationMs: 0 });
        logIds.push(log.id); ignored += 1; continue;
      }

      if (!message.hasAttachments) {
        const log = await appendLog({ accountId: account.id, accountName: account.name, emailUid: message.id, messageId: message.internetMessageId ?? null, from: fromAddress, subject, attachmentName: null, status: "ignored", paperlessDocumentId: null, appliedRuleId: null, errorMessage: REASON_LABEL["no-attachment"], durationMs: 0 });
        logIds.push(log.id); ignored += 1;
        if (account.markAsRead) await markMessageRead(accessToken, message.id).catch(() => {});
        continue;
      }

      const attachments = (await getMessageAttachments(accessToken, message.id).catch(() => []))
        .filter((a) => (a["@odata.type"] ?? "").includes("fileAttachment") && a.contentBytes);

      for (const attachment of attachments) {
        const attachmentName = attachment.name ?? "piece-jointe";
        const lite: MailContextLite = {
          accountId: account.id,
          folder: account.watchedFolder,
          from: fromAddress,
          to: toAddress,
          subject,
          attachmentName,
          attachmentExtension: getExtension(attachmentName),
          attachmentMime: attachment.contentType ?? "application/octet-stream",
          attachmentSize: attachment.size ?? 0,
          attachmentInline: Boolean(attachment.isInline),
        };
        const decision = evaluateAttachment(lite, account.attachmentRules);
        if (!decision.allow) {
          const log = await appendLog({ accountId: account.id, accountName: account.name, emailUid: message.id, messageId: message.internetMessageId ?? null, from: fromAddress, subject, attachmentName, status: "ignored", paperlessDocumentId: null, appliedRuleId: null, errorMessage: REASON_LABEL[decision.reason ?? "extension-not-allowed"], durationMs: 0 });
          logIds.push(log.id); ignored += 1; continue;
        }

        const context: MailContext = { accountId: account.id, folder: account.watchedFolder, from: fromAddress, to: toAddress, subject, attachmentName, attachmentExtension: getExtension(attachmentName) };
        const match = findMatchingRule(rules, context);
        const outcome = buildOutcome(match?.actions, { tags: account.defaultTags, correspondent: account.defaultCorrespondent, documentType: account.defaultDocumentType });
        if (outcome.ignore) {
          const log = await appendLog({ accountId: account.id, accountName: account.name, emailUid: message.id, messageId: message.internetMessageId ?? null, from: fromAddress, subject, attachmentName, status: "ignored", paperlessDocumentId: null, appliedRuleId: match?.rule.id ?? null, errorMessage: REASON_LABEL["rule-ignored"], durationMs: 0 });
          logIds.push(log.id); ignored += 1; continue;
        }

        const uploadStart = Date.now();
        const buffer = Buffer.from(attachment.contentBytes!, "base64");
        const upload = await uploadAttachmentToPaperless(attachmentName, attachment.contentType ?? "application/octet-stream", buffer, {
          title: outcome.title ?? subject ?? attachmentName,
          tags: outcome.tags,
          documentType: outcome.documentType,
          correspondent: outcome.correspondent,
          created: message.receivedDateTime ?? null,
        });
        const log = await appendLog({ accountId: account.id, accountName: account.name, emailUid: message.id, messageId: message.internetMessageId ?? null, from: fromAddress, subject, attachmentName, status: upload.ok ? "imported" : "error", paperlessDocumentId: null, appliedRuleId: match?.rule.id ?? null, errorMessage: upload.ok ? null : upload.message, durationMs: Date.now() - uploadStart });
        logIds.push(log.id);
        if (upload.ok) imported += 1; else errors += 1;
      }

      if (account.markAsRead) await markMessageRead(accessToken, message.id).catch(() => {});
      if (account.deleteAfterImport && imported > 0) await deleteMessage(accessToken, message.id).catch(() => {});
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors += 1;
    const log = await appendLog({ accountId: account.id, accountName: account.name, emailUid: null, messageId: null, from: null, subject: null, attachmentName: null, status: "error", paperlessDocumentId: null, appliedRuleId: null, errorMessage: msg, durationMs: Date.now() - started });
    logIds.push(log.id);
    await recordAccountSyncResult(accountId, { ok: false, errorMessage: msg });
    return { accountId, ok: false, imported, ignored, errors, duplicates: 0, durationMs: Date.now() - started, message: msg, logIds };
  }

  const ok = errors === 0;
  await recordAccountSyncResult(accountId, { ok, errorMessage: ok ? undefined : `${errors} erreur(s)` });
  return { accountId, ok, imported, ignored, errors, duplicates: 0, durationMs: Date.now() - started, message: ok ? `Synchronisation Microsoft terminée. ${imported} pièce(s) jointe(s) importée(s).` : `Terminé avec ${errors} erreur(s).`, logIds };
}
