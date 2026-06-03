import "server-only";

import { simpleParser } from "mailparser";
import {
  getAccountWithSecret,
  getDecryptedPassword,
  recordAccountSyncResult,
} from "./account-store";
import { withImap } from "./imap-client";
import { appendLog } from "./log-store";
import {
  evaluateAttachment,
  evaluateFolder,
  evaluateSender,
} from "./mail-filter-engine";
import type { MailContextLite, MailIgnoredReason } from "./mail-filter-types";
import { uploadAttachmentToPaperless } from "./paperless-upload";
import { buildOutcome, findMatchingRule, type MailContext } from "./rule-engine";
import { listRules } from "./rule-store";
import type { MailSyncResult } from "./types";

const REASON_LABEL: Record<MailIgnoredReason, string> = {
  "folder-excluded": "Dossier exclu",
  "label-excluded": "Label exclu",
  "sender-blocked": "Expéditeur bloqué",
  "domain-blocked": "Domaine expéditeur bloqué",
  "sender-not-allowed": "Expéditeur hors liste autorisée",
  "domain-not-allowed": "Domaine hors liste autorisée",
  "no-known-correspondent": "Aucun correspondant Paperless connu",
  "no-matching-rule": "Aucune règle d'import ne correspond",
  "extension-blocked": "Extension de pièce jointe bloquée",
  "extension-not-allowed": "Extension non autorisée par le filtre",
  "name-pattern-blocked": "Nom de pièce jointe filtré (logo/signature/tracking)",
  "size-too-small": "Pièce jointe trop petite",
  "size-too-large": "Pièce jointe trop volumineuse",
  "attachment-inline": "Pièce jointe inline ignorée",
  "already-imported": "Déjà importé",
  "rule-ignored": "Ignoré par règle utilisateur",
  "no-attachment": "Aucune pièce jointe compatible",
};

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

export async function syncMailAccount(accountId: string): Promise<MailSyncResult> {
  const started = Date.now();
  const account = await getAccountWithSecret(accountId);
  if (!account) {
    return {
      accountId,
      ok: false,
      imported: 0,
      ignored: 0,
      errors: 0,
      duplicates: 0,
      durationMs: 0,
      message: "Compte introuvable.",
      logIds: [],
    };
  }

  if (!account.isActive) {
    return {
      accountId,
      ok: false,
      imported: 0,
      ignored: 0,
      errors: 0,
      duplicates: 0,
      durationMs: 0,
      message: "Compte désactivé.",
      logIds: [],
    };
  }

  if (account.authType !== "imap-password") {
    return {
      accountId,
      ok: false,
      imported: 0,
      ignored: 0,
      errors: 0,
      duplicates: 0,
      durationMs: 0,
      message:
        "OAuth Gmail/Outlook à connecter. Synchronisation IMAP/password uniquement pour le moment.",
      logIds: [],
    };
  }

  const password = await getDecryptedPassword(accountId);
  if (!password) {
    const msg = "Aucun mot de passe stocké (stockage sécurisé à connecter).";
    await recordAccountSyncResult(accountId, { ok: false, errorMessage: msg });
    return {
      accountId,
      ok: false,
      imported: 0,
      ignored: 0,
      errors: 1,
      duplicates: 0,
      durationMs: Date.now() - started,
      message: msg,
      logIds: [],
    };
  }

  const rules = await listRules();
  let imported = 0;
  let ignored = 0;
  let errors = 0;
  const duplicates = 0;
  const logIds: string[] = [];

  try {
    const folderDecision = evaluateFolder(account.watchedFolder, account.folderRules);
    if (!folderDecision.allow) {
      const msg = REASON_LABEL[folderDecision.reason ?? "folder-excluded"];
      await recordAccountSyncResult(accountId, { ok: false, errorMessage: msg });
      return {
        accountId,
        ok: false,
        imported: 0,
        ignored: 0,
        errors: 0,
        duplicates: 0,
        durationMs: Date.now() - started,
        message: msg,
        logIds,
      };
    }

    await withImap(account, password, async (client) => {
      const lock = await client.getMailboxLock(account.watchedFolder);
      try {
        const searchCriteria = account.ignoreAlreadyRead ? { seen: false } : { all: true };
        for await (const message of client.fetch(searchCriteria, { source: true, envelope: true })) {
          const parsed = await simpleParser(message.source as Buffer);
          const fromAddress = parsed.from?.text ?? null;
          const toField = parsed.to;
          const toAddress = Array.isArray(toField)
            ? toField.map((entry) => entry.text).join(", ")
            : (toField?.text ?? null);
          const subject = parsed.subject ?? null;

          const senderDecision = evaluateSender(fromAddress, account.senderFilter);
          if (!senderDecision.allow) {
            const log = await appendLog({
              accountId: account.id,
              accountName: account.name,
              emailUid: String(message.uid),
              messageId: parsed.messageId ?? null,
              from: fromAddress,
              subject,
              attachmentName: null,
              status: "ignored",
              paperlessDocumentId: null,
              appliedRuleId: null,
              errorMessage: REASON_LABEL[senderDecision.reason ?? "sender-blocked"],
              durationMs: 0,
            });
            logIds.push(log.id);
            ignored += 1;
            continue;
          }

          const rawAttachments = parsed.attachments ?? [];

          if (rawAttachments.length === 0) {
            const log = await appendLog({
              accountId: account.id,
              accountName: account.name,
              emailUid: String(message.uid),
              messageId: parsed.messageId ?? null,
              from: fromAddress,
              subject,
              attachmentName: null,
              status: "ignored",
              paperlessDocumentId: null,
              appliedRuleId: null,
              errorMessage: REASON_LABEL["no-attachment"],
              durationMs: 0,
            });
            logIds.push(log.id);
            ignored += 1;
            continue;
          }

          for (const attachment of rawAttachments) {
            const attachmentName = attachment.filename ?? "piece-jointe";
            const attachmentExtension = getExtension(attachmentName);
            const isInline =
              (attachment.contentDisposition ?? "").toLowerCase().includes("inline") ||
              Boolean(attachment.cid);
            const lite: MailContextLite = {
              accountId: account.id,
              folder: account.watchedFolder,
              from: fromAddress,
              to: toAddress,
              subject,
              attachmentName,
              attachmentExtension,
              attachmentMime: attachment.contentType ?? "application/octet-stream",
              attachmentSize: attachment.size ?? 0,
              attachmentInline: isInline,
            };
            const attachmentDecision = evaluateAttachment(lite, account.attachmentRules);
            if (!attachmentDecision.allow) {
              const log = await appendLog({
                accountId: account.id,
                accountName: account.name,
                emailUid: String(message.uid),
                messageId: parsed.messageId ?? null,
                from: fromAddress,
                subject,
                attachmentName,
                status: "ignored",
                paperlessDocumentId: null,
                appliedRuleId: null,
                errorMessage: REASON_LABEL[attachmentDecision.reason ?? "extension-not-allowed"],
                durationMs: 0,
              });
              logIds.push(log.id);
              ignored += 1;
              continue;
            }

            const context: MailContext = {
              accountId: account.id,
              folder: account.watchedFolder,
              from: fromAddress,
              to: toAddress,
              subject,
              attachmentName,
              attachmentExtension,
            };
            const match = findMatchingRule(rules, context);
            const outcome = buildOutcome(match?.actions, {
              tags: account.defaultTags,
              correspondent: account.defaultCorrespondent,
              documentType: account.defaultDocumentType,
            });

            if (outcome.ignore) {
              const log = await appendLog({
                accountId: account.id,
                accountName: account.name,
                emailUid: String(message.uid),
                messageId: parsed.messageId ?? null,
                from: fromAddress,
                subject,
                attachmentName,
                status: "ignored",
                paperlessDocumentId: null,
                appliedRuleId: match?.rule.id ?? null,
                errorMessage: REASON_LABEL["rule-ignored"],
                durationMs: 0,
              });
              logIds.push(log.id);
              ignored += 1;
              continue;
            }

            const uploadStart = Date.now();
            const upload = await uploadAttachmentToPaperless(
              attachmentName,
              attachment.contentType ?? "application/octet-stream",
              attachment.content as Buffer,
              {
                title: outcome.title ?? subject ?? attachmentName,
                tags: outcome.tags,
                documentType: outcome.documentType,
                correspondent: outcome.correspondent,
                created: parsed.date?.toISOString() ?? null,
              },
            );

            const log = await appendLog({
              accountId: account.id,
              accountName: account.name,
              emailUid: String(message.uid),
              messageId: parsed.messageId ?? null,
              from: fromAddress,
              subject,
              attachmentName,
              status: upload.ok ? "imported" : "error",
              paperlessDocumentId: null,
              appliedRuleId: match?.rule.id ?? null,
              errorMessage: upload.ok ? null : upload.message,
              durationMs: Date.now() - uploadStart,
            });
            logIds.push(log.id);
            if (upload.ok) {
              imported += 1;
            } else {
              errors += 1;
            }
          }

          if (account.markAsRead) {
            try {
              await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
            } catch {
              // ignore flag failure
            }
          }
          if (account.deleteAfterImport && imported > 0) {
            try {
              await client.messageDelete(message.uid, { uid: true });
            } catch {
              // ignore delete failure
            }
          }
        }
      } finally {
        lock.release();
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors += 1;
    const log = await appendLog({
      accountId: account.id,
      accountName: account.name,
      emailUid: null,
      messageId: null,
      from: null,
      subject: null,
      attachmentName: null,
      status: "error",
      paperlessDocumentId: null,
      appliedRuleId: null,
      errorMessage: msg,
      durationMs: Date.now() - started,
    });
    logIds.push(log.id);
    await recordAccountSyncResult(accountId, { ok: false, errorMessage: msg });
    return {
      accountId,
      ok: false,
      imported,
      ignored,
      errors,
      duplicates,
      durationMs: Date.now() - started,
      message: msg,
      logIds,
    };
  }

  const ok = errors === 0;
  await recordAccountSyncResult(accountId, {
    ok,
    errorMessage: ok ? undefined : `${errors} erreur(s) pendant la synchronisation`,
  });
  return {
    accountId,
    ok,
    imported,
    ignored,
    errors,
    duplicates,
    durationMs: Date.now() - started,
    message: ok
      ? `Synchronisation terminée. ${imported} pièce(s) jointe(s) importée(s).`
      : `Synchronisation terminée avec ${errors} erreur(s).`,
    logIds,
  };
}
