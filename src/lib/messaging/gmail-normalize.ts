import "server-only";

import {
  decodeBase64Url,
  extractHeader,
  findAttachments,
  walkParts,
  type GmailMessage,
  type GmailThread,
} from "@/lib/connectors/gmail/gmail-api";
import type {
  EmailAddress,
  EmailAttachmentRef,
  EmailMessageRecord,
  EmailThreadRecord,
} from "./email-types";

const ADDRESS_REGEX = /(?:"?([^"<]+?)"?\s*<\s*)?([^\s<>]+@[^\s<>]+)\s*>?/g;

export function parseAddressList(header: string | null): EmailAddress[] {
  if (!header) return [];
  const out: EmailAddress[] = [];
  let match: RegExpExecArray | null;
  ADDRESS_REGEX.lastIndex = 0;
  while ((match = ADDRESS_REGEX.exec(header))) {
    const [, rawName, rawEmail] = match;
    const email = (rawEmail ?? "").trim().toLowerCase();
    if (!email) continue;
    const name = rawName?.trim().replace(/^["']|["']$/g, "") || null;
    out.push({ email, name });
    if (out.length >= 20) break;
  }
  return out;
}

export function firstAddress(header: string | null): EmailAddress | null {
  return parseAddressList(header)[0] ?? null;
}

function pickBody(message: GmailMessage): { text: string; html: string | null } {
  let text = "";
  let html: string | null = null;
  for (const part of walkParts(message)) {
    if (!part.body?.data) continue;
    const mime = (part.mimeType ?? "").toLowerCase();
    const decoded = decodeBase64Url(part.body.data).toString("utf8");
    if (mime === "text/plain" && !text) text = decoded;
    if (mime === "text/html" && !html) html = decoded;
  }
  // If we only have HTML, derive a text fallback by stripping tags.
  if (!text && html) {
    text = html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return { text: text.trim(), html };
}

function normaliseAttachments(message: GmailMessage): EmailAttachmentRef[] {
  return findAttachments(message).map((attachment) => ({
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    attachmentId: attachment.attachmentId,
    inline: attachment.inline,
  }));
}

function parseInternalDate(message: GmailMessage): string | null {
  const headerDate = extractHeader(message, "date");
  if (headerDate) {
    const parsed = new Date(headerDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (message.internalDate) {
    const ms = Number.parseInt(message.internalDate, 10);
    if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString();
  }
  return null;
}

export function normaliseGmailMessage(
  message: GmailMessage,
  context: { accountId: string; accountEmail: string }
): EmailMessageRecord {
  const subject = extractHeader(message, "subject");
  const from = firstAddress(extractHeader(message, "from"));
  const to = parseAddressList(extractHeader(message, "to"));
  const cc = parseAddressList(extractHeader(message, "cc"));
  const bcc = parseAddressList(extractHeader(message, "bcc"));
  const { text, html } = pickBody(message);
  const labelIds = message.labelIds ?? [];

  return {
    id: message.id,
    threadId: message.threadId,
    accountId: context.accountId,
    accountEmail: context.accountEmail,
    date: parseInternalDate(message),
    snippet: message.snippet ?? null,
    subject,
    from,
    to,
    cc,
    bcc,
    labelIds,
    attachments: normaliseAttachments(message),
    unread: labelIds.includes("UNREAD"),
    important: labelIds.includes("IMPORTANT") || labelIds.includes("STARRED"),
    bodyText: text,
    bodyHtml: html,
  };
}

/**
 * Aggrège un `GmailThread` (avec messages chargés) vers un `EmailThreadRecord`.
 */
export function normaliseGmailThread(
  thread: GmailThread,
  context: { accountId: string; accountEmail: string }
): EmailThreadRecord {
  const messages = (thread.messages ?? []).map((message) =>
    normaliseGmailMessage(message, context)
  );

  // Latest message wins for subject/snippet/date.
  const sorted = [...messages].sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    return da < db ? 1 : da > db ? -1 : 0;
  });
  const latest = sorted[0];

  const participants = new Map<string, EmailAddress>();
  for (const message of messages) {
    if (message.from) participants.set(message.from.email, message.from);
    for (const target of [...message.to, ...message.cc]) {
      if (!participants.has(target.email)) participants.set(target.email, target);
    }
  }

  const allLabels = new Set<string>();
  let totalAttachments = 0;
  let unread = false;
  let important = false;
  for (const message of messages) {
    for (const id of message.labelIds) allLabels.add(id);
    totalAttachments += message.attachments.filter((a) => !a.inline).length;
    if (message.unread) unread = true;
    if (message.important) important = true;
  }

  return {
    id: thread.id,
    accountId: context.accountId,
    accountEmail: context.accountEmail,
    subject: latest?.subject ?? null,
    snippet: thread.snippet ?? latest?.snippet ?? null,
    lastMessageAt: latest?.date ?? null,
    participants: Array.from(participants.values()).slice(0, 10),
    messageCount: messages.length,
    attachmentCount: totalAttachments,
    hasAttachments: totalAttachments > 0,
    unread,
    important,
    labelIds: Array.from(allLabels),
  };
}
