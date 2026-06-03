import "server-only";

import { simpleParser } from "mailparser";
import { getAccountWithSecret, getDecryptedPassword } from "./account-store";
import {
  evaluateAttachment,
  evaluateFolder,
  evaluateGmailLabels,
  evaluateSender,
} from "./mail-filter-engine";
import { withImap } from "./imap-client";
import { buildOutcome, findMatchingRule, type MailContext } from "./rule-engine";
import { listRules } from "./rule-store";
import {
  extractHeader,
  findAttachments,
  getGmailMessage,
  listGmailMessages,
} from "@/lib/connectors/gmail/gmail-api";
import type {
  MailContextLite,
  MailIgnoredReason,
  MailImportDecision,
  MailSyncPreview,
  MailSyncPreviewItem,
} from "./mail-filter-types";
import type { MailAccount } from "./types";

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

function emptyPreview(accountId: string): MailSyncPreview {
  return {
    accountId,
    scannedFolders: [],
    skippedFolders: [],
    wouldImport: [],
    wouldIgnore: [],
    errors: [],
    summary: { scanned: 0, importable: 0, ignored: 0, duplicates: 0, errors: 0 },
  };
}

function pushDecision(
  preview: MailSyncPreview,
  item: MailSyncPreviewItem,
) {
  preview.summary.scanned += 1;
  if (item.decision.status === "imported") {
    preview.wouldImport.push(item);
    preview.summary.importable += 1;
  } else if (item.decision.status === "duplicate") {
    preview.wouldIgnore.push(item);
    preview.summary.duplicates += 1;
  } else if (item.decision.status === "error") {
    preview.wouldIgnore.push(item);
    preview.summary.errors += 1;
  } else {
    preview.wouldIgnore.push(item);
    preview.summary.ignored += 1;
  }
}

function decisionFromReason(reason: MailIgnoredReason | null, ruleId: string | null = null): MailImportDecision {
  return {
    status: "ignored",
    reason,
    appliedRuleId: ruleId,
    appliedRuleName: null,
  };
}

export async function previewMailSync(accountId: string, limit = 30): Promise<MailSyncPreview> {
  const account = await getAccountWithSecret(accountId);
  const preview = emptyPreview(accountId);
  if (!account) {
    preview.errors.push({ folder: "—", message: "Compte introuvable." });
    return preview;
  }

  if (account.connector === "gmail-oauth") {
    return previewGmail(account, limit);
  }
  return previewImap(account, limit);
}

async function previewImap(account: MailAccount, limit: number): Promise<MailSyncPreview> {
  const preview = emptyPreview(account.id);
  preview.scannedFolders.push(account.watchedFolder);

  const folderDecision = evaluateFolder(account.watchedFolder, account.folderRules);
  if (!folderDecision.allow) {
    preview.skippedFolders.push(account.watchedFolder);
    return preview;
  }

  const password = await getDecryptedPassword(account.id);
  if (!password) {
    preview.errors.push({
      folder: account.watchedFolder,
      message: "Aucun mot de passe stocké (stockage sécurisé à connecter).",
    });
    return preview;
  }

  const rules = await listRules();

  try {
    await withImap(account, password, async (client) => {
      const lock = await client.getMailboxLock(account.watchedFolder);
      try {
        const criteria = account.ignoreAlreadyRead ? { seen: false } : { all: true };
        let scanned = 0;
        for await (const message of client.fetch(criteria, { source: true, envelope: true })) {
          if (scanned >= limit) break;
          scanned += 1;
          const parsed = await simpleParser(message.source as Buffer);
          const fromAddress = parsed.from?.text ?? null;
          const subject = parsed.subject ?? null;

          const senderDecision = evaluateSender(fromAddress, account.senderFilter);
          if (!senderDecision.allow) {
            pushDecision(preview, {
              uid: String(message.uid),
              folder: account.watchedFolder,
              from: fromAddress,
              subject,
              attachmentName: null,
              attachmentSize: null,
              attachmentMime: null,
              decision: decisionFromReason(senderDecision.reason),
            });
            continue;
          }

          const attachments = parsed.attachments ?? [];
          if (attachments.length === 0) {
            pushDecision(preview, {
              uid: String(message.uid),
              folder: account.watchedFolder,
              from: fromAddress,
              subject,
              attachmentName: null,
              attachmentSize: null,
              attachmentMime: null,
              decision: decisionFromReason("no-attachment"),
            });
            continue;
          }

          for (const attachment of attachments) {
            const attachmentName = attachment.filename ?? "piece-jointe";
            const lite: MailContextLite = {
              accountId: account.id,
              folder: account.watchedFolder,
              from: fromAddress,
              to: parsed.to && !Array.isArray(parsed.to) ? parsed.to.text : null,
              subject,
              attachmentName,
              attachmentExtension: getExtension(attachmentName),
              attachmentMime: attachment.contentType ?? "application/octet-stream",
              attachmentSize: attachment.size ?? 0,
              attachmentInline:
                (attachment.contentDisposition ?? "").toLowerCase().includes("inline") ||
                Boolean(attachment.cid),
            };
            const decision = evaluateAttachment(lite, account.attachmentRules);
            if (!decision.allow) {
              pushDecision(preview, {
                uid: String(message.uid),
                folder: account.watchedFolder,
                from: fromAddress,
                subject,
                attachmentName,
                attachmentSize: lite.attachmentSize,
                attachmentMime: lite.attachmentMime,
                decision: decisionFromReason(decision.reason),
              });
              continue;
            }

            const ctx: MailContext = {
              accountId: account.id,
              folder: account.watchedFolder,
              from: fromAddress,
              to: lite.to,
              subject,
              attachmentName,
              attachmentExtension: lite.attachmentExtension,
            };
            const match = findMatchingRule(rules, ctx);
            const outcome = buildOutcome(match?.actions, {
              tags: account.defaultTags,
              correspondent: account.defaultCorrespondent,
              documentType: account.defaultDocumentType,
            });
            if (outcome.ignore) {
              pushDecision(preview, {
                uid: String(message.uid),
                folder: account.watchedFolder,
                from: fromAddress,
                subject,
                attachmentName,
                attachmentSize: lite.attachmentSize,
                attachmentMime: lite.attachmentMime,
                decision: decisionFromReason("rule-ignored", match?.rule.id ?? null),
              });
              continue;
            }

            pushDecision(preview, {
              uid: String(message.uid),
              folder: account.watchedFolder,
              from: fromAddress,
              subject,
              attachmentName,
              attachmentSize: lite.attachmentSize,
              attachmentMime: lite.attachmentMime,
              decision: {
                status: "imported",
                reason: null,
                appliedRuleId: match?.rule.id ?? null,
                appliedRuleName: match?.rule.name ?? null,
                paperlessTitle: outcome.title ?? subject ?? attachmentName,
                paperlessCorrespondentId: outcome.correspondent,
                paperlessDocumentTypeId: outcome.documentType,
                paperlessTagIds: outcome.tags,
              },
            });
          }
        }
      } finally {
        lock.release();
      }
    });
  } catch (error) {
    preview.errors.push({
      folder: account.watchedFolder,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return preview;
}

async function previewGmail(account: MailAccount, limit: number): Promise<MailSyncPreview> {
  const preview = emptyPreview(account.id);
  preview.scannedFolders.push(...(account.folderRules?.watchedFolders ?? ["INBOX"]));

  const rules = await listRules();
  try {
    const { messages } = await listGmailMessages(
      account.id,
      "has:attachment -in:spam -in:trash -category:promotions -category:social newer_than:30d",
      Math.min(limit, 50),
    );
    for (const ref of messages) {
      const message = await getGmailMessage(account.id, ref.id);
      const labelIds = message.labelIds ?? [];
      const folderDecision = evaluateGmailLabels(labelIds, account.folderRules);
      if (!folderDecision.allow) {
        pushDecision(preview, {
          uid: ref.id,
          folder: labelIds[0] ?? "INBOX",
          from: extractHeader(message, "From"),
          subject: extractHeader(message, "Subject"),
          attachmentName: null,
          attachmentSize: null,
          attachmentMime: null,
          decision: decisionFromReason(folderDecision.reason),
        });
        continue;
      }
      const sender = extractHeader(message, "From");
      const senderDecision = evaluateSender(sender, account.senderFilter);
      if (!senderDecision.allow) {
        pushDecision(preview, {
          uid: ref.id,
          folder: labelIds[0] ?? "INBOX",
          from: sender,
          subject: extractHeader(message, "Subject"),
          attachmentName: null,
          attachmentSize: null,
          attachmentMime: null,
          decision: decisionFromReason(senderDecision.reason),
        });
        continue;
      }
      const attachments = findAttachments(message);
      if (attachments.length === 0) {
        pushDecision(preview, {
          uid: ref.id,
          folder: labelIds[0] ?? "INBOX",
          from: sender,
          subject: extractHeader(message, "Subject"),
          attachmentName: null,
          attachmentSize: null,
          attachmentMime: null,
          decision: decisionFromReason("no-attachment"),
        });
        continue;
      }
      for (const attachment of attachments) {
        const lite: MailContextLite = {
          accountId: account.id,
          folder: labelIds[0] ?? "INBOX",
          from: sender,
          to: extractHeader(message, "To"),
          subject: extractHeader(message, "Subject"),
          attachmentName: attachment.filename,
          attachmentExtension: getExtension(attachment.filename),
          attachmentMime: attachment.mimeType,
          attachmentSize: attachment.size,
          attachmentInline: attachment.inline,
        };
        const decision = evaluateAttachment(lite, account.attachmentRules);
        if (!decision.allow) {
          pushDecision(preview, {
            uid: ref.id,
            folder: lite.folder,
            from: sender,
            subject: lite.subject,
            attachmentName: lite.attachmentName,
            attachmentSize: lite.attachmentSize,
            attachmentMime: lite.attachmentMime,
            decision: decisionFromReason(decision.reason),
          });
          continue;
        }
        const ctx: MailContext = {
          accountId: account.id,
          folder: lite.folder,
          from: sender,
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
          pushDecision(preview, {
            uid: ref.id,
            folder: lite.folder,
            from: sender,
            subject: lite.subject,
            attachmentName: lite.attachmentName,
            attachmentSize: lite.attachmentSize,
            attachmentMime: lite.attachmentMime,
            decision: decisionFromReason("rule-ignored", match?.rule.id ?? null),
          });
          continue;
        }
        pushDecision(preview, {
          uid: ref.id,
          folder: lite.folder,
          from: sender,
          subject: lite.subject,
          attachmentName: lite.attachmentName,
          attachmentSize: lite.attachmentSize,
          attachmentMime: lite.attachmentMime,
          decision: {
            status: "imported",
            reason: null,
            appliedRuleId: match?.rule.id ?? null,
            appliedRuleName: match?.rule.name ?? null,
            paperlessTitle: outcome.title ?? lite.subject ?? lite.attachmentName,
            paperlessCorrespondentId: outcome.correspondent,
            paperlessDocumentTypeId: outcome.documentType,
            paperlessTagIds: outcome.tags,
          },
        });
      }
    }
  } catch (error) {
    preview.errors.push({
      folder: "Gmail",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return preview;
}
