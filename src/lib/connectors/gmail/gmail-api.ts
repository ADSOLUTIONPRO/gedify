import "server-only";

import { randomUUID } from "node:crypto";
import { getGmailOAuthConfig, refreshAccessToken } from "./oauth";
import {
  getCachedAccessToken,
  getGmailRefreshToken,
  updateCachedAccessToken,
} from "./gmail-token-store";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailMessageRef = { id: string; threadId: string };

export type GmailHeader = { name: string; value: string };

export type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailMessagePart;
  snippet?: string;
};

export async function getAccessTokenForAccount(accountId: string): Promise<string> {
  const cached = await getCachedAccessToken(accountId);
  if (cached) return cached;

  const config = getGmailOAuthConfig();
  if (!config) throw new Error("OAuth Google non configuré.");
  const tokens = await getGmailRefreshToken(accountId);
  if (!tokens) throw new Error("Compte Gmail introuvable ou refresh_token absent.");

  const fresh = await refreshAccessToken(config, tokens.refreshToken);
  const expiresAt = Date.now() + (fresh.expires_in - 60) * 1000;
  await updateCachedAccessToken(accountId, fresh.access_token, expiresAt);
  return fresh.access_token;
}

async function gmailFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API ${response.status} on ${path}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export async function listGmailMessages(
  accountId: string,
  query: string,
  maxResults = 50,
  pageToken?: string,
): Promise<{ messages: GmailMessageRef[]; nextPageToken?: string }> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const search = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });
  if (pageToken) search.set("pageToken", pageToken);
  const data = await gmailFetch<{ messages?: GmailMessageRef[]; nextPageToken?: string }>(
    accessToken,
    `/messages?${search.toString()}`,
  );
  return { messages: data.messages ?? [], nextPageToken: data.nextPageToken };
}

export async function getGmailMessage(
  accountId: string,
  messageId: string,
): Promise<GmailMessage> {
  const accessToken = await getAccessTokenForAccount(accountId);
  return gmailFetch<GmailMessage>(accessToken, `/messages/${messageId}?format=full`);
}

export async function getGmailAttachment(
  accountId: string,
  messageId: string,
  attachmentId: string,
): Promise<{ data: string; size: number }> {
  const accessToken = await getAccessTokenForAccount(accountId);
  return gmailFetch<{ data: string; size: number }>(
    accessToken,
    `/messages/${messageId}/attachments/${attachmentId}`,
  );
}

export type GmailThreadRef = { id: string; snippet?: string; historyId?: string };

export type GmailThread = {
  id: string;
  snippet?: string;
  historyId?: string;
  messages?: GmailMessage[];
};

export async function listGmailThreads(
  accountId: string,
  query: string,
  maxResults = 50,
  pageToken?: string
): Promise<{ threads: GmailThreadRef[]; nextPageToken?: string; resultSizeEstimate?: number }> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const search = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });
  if (pageToken) search.set("pageToken", pageToken);
  const data = await gmailFetch<{
    threads?: GmailThreadRef[];
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }>(accessToken, `/threads?${search.toString()}`);
  return {
    threads: data.threads ?? [],
    nextPageToken: data.nextPageToken,
    resultSizeEstimate: data.resultSizeEstimate,
  };
}

export async function getGmailThread(
  accountId: string,
  threadId: string,
  format: "full" | "metadata" | "minimal" = "full"
): Promise<GmailThread> {
  const accessToken = await getAccessTokenForAccount(accountId);
  return gmailFetch<GmailThread>(accessToken, `/threads/${threadId}?format=${format}`);
}

export async function listGmailLabels(
  accountId: string,
): Promise<{ id: string; name: string; type?: string }[]> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const data = await gmailFetch<{ labels?: { id: string; name: string; type?: string }[] }>(
    accessToken,
    "/labels",
  );
  return data.labels ?? [];
}

/** Ajoute/retire des libellés sur un fil (archiver = retirer INBOX, lu = retirer UNREAD). */
export async function modifyGmailThread(
  accountId: string,
  threadId: string,
  mods: { addLabelIds?: string[]; removeLabelIds?: string[] },
): Promise<void> {
  const accessToken = await getAccessTokenForAccount(accountId);
  await gmailFetch(accessToken, `/threads/${threadId}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mods),
  });
}

/** Déplace un fil vers la corbeille Gmail (réversible). */
export async function trashGmailThread(accountId: string, threadId: string): Promise<void> {
  const accessToken = await getAccessTokenForAccount(accountId);
  await gmailFetch(accessToken, `/threads/${threadId}/trash`, { method: "POST" });
}

export type GmailAttachmentRef = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  inline: boolean;
  contentId: string | null;
};

export function extractHeader(message: GmailMessage, name: string): string | null {
  const headers = message.payload?.headers ?? [];
  const found = headers.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}

export function walkParts(message: GmailMessage): GmailMessagePart[] {
  const result: GmailMessagePart[] = [];
  const stack: GmailMessagePart[] = [];
  if (message.payload) stack.push(message.payload);
  while (stack.length) {
    const part = stack.pop()!;
    result.push(part);
    if (part.parts) {
      for (const child of part.parts) stack.push(child);
    }
  }
  return result;
}

export function findAttachments(message: GmailMessage): GmailAttachmentRef[] {
  const refs: GmailAttachmentRef[] = [];
  for (const part of walkParts(message)) {
    if (!part.body?.attachmentId) continue;
    const filename = part.filename || "piece-jointe";
    const dispositionHeader = (part.headers ?? []).find(
      (entry) => entry.name.toLowerCase() === "content-disposition",
    );
    const inline = dispositionHeader?.value?.toLowerCase().includes("inline") ?? false;
    const contentIdHeader = (part.headers ?? []).find(
      (entry) => entry.name.toLowerCase() === "content-id",
    );
    refs.push({
      filename,
      mimeType: part.mimeType ?? "application/octet-stream",
      size: part.body.size ?? 0,
      attachmentId: part.body.attachmentId,
      inline,
      contentId: contentIdHeader?.value ?? null,
    });
  }
  return refs;
}

export function decodeBase64Url(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// ---------------------------------------------------------------------------
// Drafts & Send (scope requis : gmail.compose ou gmail.send)
// ---------------------------------------------------------------------------

type GmailDraftMessage = {
  id: string;
  message: { id: string; threadId: string; labelIds: string[] };
};

/** Encode un email RFC 2822 en base64url pour l'API Gmail */
export type EmailAttachment = { filename: string; mimeType: string; contentBase64: string };

export type SendEncodeOptions = {
  threadId?: string;
  inReplyTo?: string;
  cc?: string | null;
  bcc?: string | null;
  /** Corps HTML (richtext). Sinon texte brut. */
  html?: boolean;
  /** Pièces jointes (encodées base64) → message multipart/mixed. */
  attachments?: EmailAttachment[];
};

function toBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeRfc2822(to: string, subject: string, body: string, opts: SendEncodeOptions = {}): string {
  const headers = [`To: ${to}`];
  if (opts.cc) headers.push(`Cc: ${opts.cc}`);
  if (opts.bcc) headers.push(`Bcc: ${opts.bcc}`);
  headers.push(`Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`, "MIME-Version: 1.0");
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);

  const contentType = `text/${opts.html ? "html" : "plain"}; charset="UTF-8"`;
  // Corps encodé en base64 (UTF-8 sûr : accents, HTML…), lignes ≤ 76 car.
  const bodyB64 = Buffer.from(body, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");

  if (!opts.attachments || opts.attachments.length === 0) {
    const raw = [...headers, `Content-Type: ${contentType}`, "Content-Transfer-Encoding: base64", "", bodyB64].join("\r\n");
    return toBase64Url(raw);
  }

  // multipart/mixed : corps + pièces jointes
  const boundary = `ged_${randomUUID()}`;
  const parts: string[] = [
    [`--${boundary}`, `Content-Type: ${contentType}`, "Content-Transfer-Encoding: base64", "", bodyB64].join("\r\n"),
  ];
  for (const att of opts.attachments) {
    const safeName = att.filename.replace(/["\r\n]/g, "_");
    const data = att.contentBase64.replace(/\s+/g, "").replace(/(.{76})/g, "$1\r\n");
    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${att.mimeType || "application/octet-stream"}; name="${safeName}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${safeName}"`,
        "",
        data,
      ].join("\r\n"),
    );
  }
  const raw = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    parts.join("\r\n"),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return toBase64Url(raw);
}

/** Crée un brouillon Gmail (scope : gmail.compose) */
export async function createGmailDraft(
  accountId: string,
  to: string,
  subject: string,
  body: string,
  opts: SendEncodeOptions = {},
): Promise<GmailDraftMessage> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const raw = encodeRfc2822(to, subject, body, opts);
  const payload: Record<string, unknown> = { message: { raw } };
  if (opts.threadId) (payload.message as Record<string, unknown>).threadId = opts.threadId;
  return gmailFetch<GmailDraftMessage>(accessToken, "/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Met à jour un brouillon Gmail existant */
export async function updateGmailDraft(
  accountId: string,
  draftId: string,
  to: string,
  subject: string,
  body: string,
  opts: SendEncodeOptions = {},
): Promise<GmailDraftMessage> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const raw = encodeRfc2822(to, subject, body, opts);
  const payload: Record<string, unknown> = { id: draftId, message: { raw } };
  if (opts.threadId) (payload.message as Record<string, unknown>).threadId = opts.threadId;
  return gmailFetch<GmailDraftMessage>(accessToken, `/drafts/${draftId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Envoie un email depuis Gmail (scope : gmail.send) */
export async function sendGmailMessage(
  accountId: string,
  to: string,
  subject: string,
  body: string,
  opts: SendEncodeOptions = {},
): Promise<{ id: string; threadId: string; labelIds: string[] }> {
  const accessToken = await getAccessTokenForAccount(accountId);
  const raw = encodeRfc2822(to, subject, body, opts);
  const payload: Record<string, unknown> = { raw };
  if (opts.threadId) payload.threadId = opts.threadId;
  return gmailFetch<{ id: string; threadId: string; labelIds: string[] }>(
    accessToken,
    "/messages/send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

/** Supprime un brouillon Gmail */
export async function deleteGmailDraft(accountId: string, draftId: string): Promise<void> {
  const accessToken = await getAccessTokenForAccount(accountId);
  await fetch(`${GMAIL_API_BASE}/drafts/${draftId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
