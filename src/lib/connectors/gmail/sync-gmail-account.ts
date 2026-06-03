import "server-only";

import {
  decodeBase64Url,
  extractHeader,
  findAttachments,
  getGmailAttachment,
  getGmailMessage,
  listGmailMessages,
  type GmailAttachmentRef,
} from "./gmail-api";
import { recordAccountSyncResult } from "@/lib/mail-connector/account-store";
import { appendLog } from "@/lib/mail-connector/log-store";
import { uploadAttachmentToPaperless } from "@/lib/mail-connector/paperless-upload";
import {
  evaluateAttachment,
  evaluateGmailLabels,
  evaluateSender,
} from "@/lib/mail-connector/mail-filter-engine";
import {
  buildOutcome,
  findMatchingRule,
  type MailContext,
} from "@/lib/mail-connector/rule-engine";
import { listRules } from "@/lib/mail-connector/rule-store";
import { isAttachmentSuppressed } from "@/lib/mail-connector/suppressed-attachments-store";
import { createMailDocumentLink, findExistingLink } from "@/lib/messaging/mail-document-links-store";
import { getPaperlessTaskById } from "@/lib/paperless/paperless-tasks";
import type {
  MailContextLite,
  MailIgnoredReason,
} from "@/lib/mail-connector/mail-filter-types";
import type { MailAccount, MailSyncResult } from "@/lib/mail-connector/types";

/** Résout l'id du document Paperless créé à partir de l'id de tâche (best-effort). */
async function resolveImportedDocId(taskId: string | null): Promise<number | null> {
  if (!taskId) return null;
  for (let i = 0; i < 6; i += 1) {
    const task = await getPaperlessTaskById(taskId).catch(() => null);
    if (task?.relatedDocumentId) return task.relatedDocumentId;
    if (task?.status === "FAILURE") return null;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}

const REASON_TO_LOG: Record<MailIgnoredReason, string> = {
  "folder-excluded": "Dossier exclu",
  "label-excluded": "Label Gmail exclu",
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

function buildGmailQuery(account: MailAccount): string {
  const parts = ["has:attachment", "-in:spam", "-in:trash", "-category:promotions", "-category:social"];
  if (account.ignoreAlreadyRead) parts.push("is:unread");
  parts.push("newer_than:30d");
  return parts.join(" ");
}

export async function syncGmailAccount(account: MailAccount): Promise<MailSyncResult> {
  const started = Date.now();
  const logIds: string[] = [];
  let imported = 0;
  let ignored = 0;
  let errors = 0;
  let duplicates = 0;

  if (!account.isActive) {
    return {
      accountId: account.id,
      ok: false,
      imported: 0,
      ignored: 0,
      errors: 0,
      duplicates: 0,
      durationMs: 0,
      message: "Compte désactivé.",
      logIds,
    };
  }

  const rules = await listRules();
  const query = buildGmailQuery(account);

  try {
    let pageToken: string | undefined;
    let scanned = 0;
    do {
      const { messages, nextPageToken } = await listGmailMessages(
        account.id,
        query,
        50,
        pageToken,
      );
      for (const ref of messages) {
        scanned += 1;
        const message = await getGmailMessage(account.id, ref.id);
        const labelIds = message.labelIds ?? [];

        const folderDecision = evaluateGmailLabels(labelIds, account.folderRules);
        if (!folderDecision.allow) {
          const log = await appendLog({
            accountId: account.id,
            accountName: account.name,
            emailUid: ref.id,
            messageId: extractHeader(message, "Message-Id"),
            from: extractHeader(message, "From"),
            subject: extractHeader(message, "Subject"),
            attachmentName: null,
            status: "ignored",
            paperlessDocumentId: null,
            appliedRuleId: null,
            errorMessage: REASON_TO_LOG[folderDecision.reason ?? "label-excluded"],
            durationMs: 0,
          });
          logIds.push(log.id);
          ignored += 1;
          continue;
        }

        const senderDecision = evaluateSender(extractHeader(message, "From"), account.senderFilter, {});
        if (!senderDecision.allow) {
          const log = await appendLog({
            accountId: account.id,
            accountName: account.name,
            emailUid: ref.id,
            messageId: extractHeader(message, "Message-Id"),
            from: extractHeader(message, "From"),
            subject: extractHeader(message, "Subject"),
            attachmentName: null,
            status: "ignored",
            paperlessDocumentId: null,
            appliedRuleId: null,
            errorMessage: REASON_TO_LOG[senderDecision.reason ?? "sender-blocked"],
            durationMs: 0,
          });
          logIds.push(log.id);
          ignored += 1;
          continue;
        }

        const attachments = findAttachments(message);
        if (attachments.length === 0) {
          const log = await appendLog({
            accountId: account.id,
            accountName: account.name,
            emailUid: ref.id,
            messageId: extractHeader(message, "Message-Id"),
            from: extractHeader(message, "From"),
            subject: extractHeader(message, "Subject"),
            attachmentName: null,
            status: "ignored",
            paperlessDocumentId: null,
            appliedRuleId: null,
            errorMessage: REASON_TO_LOG["no-attachment"],
            durationMs: 0,
          });
          logIds.push(log.id);
          ignored += 1;
          continue;
        }

        for (const attachment of attachments) {
          const lite: MailContextLite = {
            accountId: account.id,
            folder: labelIds[0] ?? "INBOX",
            from: extractHeader(message, "From"),
            to: extractHeader(message, "To"),
            subject: extractHeader(message, "Subject"),
            attachmentName: attachment.filename,
            attachmentExtension: getExtension(attachment.filename),
            attachmentMime: attachment.mimeType,
            attachmentSize: attachment.size,
            attachmentInline: attachment.inline,
          };

          const attachmentDecision = evaluateAttachment(lite, account.attachmentRules);
          if (!attachmentDecision.allow) {
            const log = await appendLog({
              accountId: account.id,
              accountName: account.name,
              emailUid: ref.id,
              messageId: extractHeader(message, "Message-Id"),
              from: lite.from,
              subject: lite.subject,
              attachmentName: lite.attachmentName,
              status: "ignored",
              paperlessDocumentId: null,
              appliedRuleId: null,
              errorMessage: REASON_TO_LOG[attachmentDecision.reason ?? "extension-not-allowed"],
              durationMs: 0,
            });
            logIds.push(log.id);
            ignored += 1;
            continue;
          }

          // §5 — pièce jointe supprimée volontairement : ne pas réimporter.
          const signature = {
            messageId: message.id,
            attachmentId: attachment.attachmentId,
            filename: attachment.filename,
            sizeBytes: attachment.size,
          };
          if (await isAttachmentSuppressed(signature)) {
            const log = await appendLog({
              accountId: account.id, accountName: account.name, emailUid: ref.id,
              messageId: extractHeader(message, "Message-Id"), from: lite.from, subject: lite.subject,
              attachmentName: lite.attachmentName, status: "ignored", paperlessDocumentId: null,
              appliedRuleId: null, errorMessage: "Document supprimé volontairement de la GED — non réimporté", durationMs: 0,
            });
            logIds.push(log.id);
            ignored += 1;
            continue;
          }
          // Anti-doublon : déjà importé lors d'une sync précédente.
          if (await findExistingLink(message.id, attachment.attachmentId)) {
            duplicates += 1;
            continue;
          }

          const ctx: MailContext = {
            accountId: account.id,
            folder: lite.folder,
            from: lite.from,
            to: lite.to,
            subject: lite.subject,
            attachmentName: lite.attachmentName,
            attachmentExtension: lite.attachmentExtension,
          };
          const match = findMatchingRule(rules, ctx);
          const outcome = buildOutcome(match?.actions, {
            tags: account.defaultTags,
            correspondent: account.defaultCorrespondent,
            documentType: account.defaultDocumentType,
          });

          if (outcome.ignore) {
            const log = await appendLog({
              accountId: account.id,
              accountName: account.name,
              emailUid: ref.id,
              messageId: extractHeader(message, "Message-Id"),
              from: lite.from,
              subject: lite.subject,
              attachmentName: lite.attachmentName,
              status: "ignored",
              paperlessDocumentId: null,
              appliedRuleId: match?.rule.id ?? null,
              errorMessage: REASON_TO_LOG["rule-ignored"],
              durationMs: 0,
            });
            logIds.push(log.id);
            ignored += 1;
            continue;
          }

          const threadId = (message as { threadId?: string }).threadId ?? message.id;
          await processAttachment(account, message.id, threadId, attachment, ctx, outcome, match?.rule.id ?? null, logIds)
            .then((result) => {
              if (result === "imported") imported += 1;
              else errors += 1;
            });
        }
      }
      pageToken = nextPageToken;
    } while (pageToken && scanned < 500);
  } catch (error) {
    errors += 1;
    const msg = error instanceof Error ? error.message : String(error);
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
    await recordAccountSyncResult(account.id, { ok: false, errorMessage: msg });
    return {
      accountId: account.id,
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
  await recordAccountSyncResult(account.id, {
    ok,
    errorMessage: ok ? undefined : `${errors} erreur(s) pendant la synchronisation Gmail`,
  });
  return {
    accountId: account.id,
    ok,
    imported,
    ignored,
    errors,
    duplicates,
    durationMs: Date.now() - started,
    message: ok
      ? `Synchronisation Gmail terminée. ${imported} pièce(s) jointe(s) importée(s), ${ignored} ignorée(s).`
      : `Synchronisation Gmail terminée avec ${errors} erreur(s).`,
    logIds,
  };
}

async function processAttachment(
  account: MailAccount,
  messageId: string,
  threadId: string,
  attachment: GmailAttachmentRef,
  ctx: MailContext,
  outcome: ReturnType<typeof buildOutcome>,
  ruleId: string | null,
  logIds: string[],
): Promise<"imported" | "error"> {
  const start = Date.now();
  try {
    const body = await getGmailAttachment(account.id, messageId, attachment.attachmentId);
    const buffer = decodeBase64Url(body.data);
    const title = outcome.title ?? ctx.subject ?? attachment.filename;
    const upload = await uploadAttachmentToPaperless(
      attachment.filename,
      attachment.mimeType,
      buffer,
      {
        title,
        tags: outcome.tags,
        documentType: outcome.documentType,
        correspondent: outcome.correspondent,
      },
    );

    // §5 — tracer le lien mail↔document (permet la déduplication et la
    // suppression volontaire future). Best-effort : n'échoue jamais l'import.
    if (upload.ok) {
      const documentId = await resolveImportedDocId(upload.taskId);
      await createMailDocumentLink({
        accountId: account.id,
        mailId: messageId,
        threadId,
        attachmentId: attachment.attachmentId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.size,
        paperlessDocumentId: documentId,
        documentTitle: title,
        status: "imported",
        errorMessage: null,
      }).catch(() => {});
    }

    const log = await appendLog({
      accountId: account.id,
      accountName: account.name,
      emailUid: messageId,
      messageId: null,
      from: ctx.from,
      subject: ctx.subject,
      attachmentName: attachment.filename,
      status: upload.ok ? "imported" : "error",
      paperlessDocumentId: null,
      appliedRuleId: ruleId,
      errorMessage: upload.ok ? null : upload.message,
      durationMs: Date.now() - start,
    });
    logIds.push(log.id);
    return upload.ok ? "imported" : "error";
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const log = await appendLog({
      accountId: account.id,
      accountName: account.name,
      emailUid: messageId,
      messageId: null,
      from: ctx.from,
      subject: ctx.subject,
      attachmentName: attachment.filename,
      status: "error",
      paperlessDocumentId: null,
      appliedRuleId: ruleId,
      errorMessage: msg,
      durationMs: Date.now() - start,
    });
    logIds.push(log.id);
    return "error";
  }
}
