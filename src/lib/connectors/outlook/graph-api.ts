import "server-only";

import { OutlookReconnectError } from "./oauth";
import { getValidOutlookAccessToken } from "./outlook-access";

/* ────────────────────────────────────────────────────────────────────────
   Client Microsoft Graph (v1.0) pour les comptes Outlook/Microsoft connectés
   en OAuth2. Couvre : profil, dossiers, messages + pièces jointes, marquage
   lu, envoi (avec PJ), événements d'agenda et contacts. Le jeton est obtenu
   et rafraîchi via outlook-access (offline_access). Un 401 → OutlookReconnect.
   ──────────────────────────────────────────────────────────────────────── */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    throw new OutlookReconnectError("Accès Microsoft expiré ou révoqué — reconnectez le compte.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph ${path} (${res.status}): ${text.slice(0, 400)}`);
  }
  return res;
}

async function graphJson<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await graphFetch(accessToken, path, init);
  return res.json() as Promise<T>;
}

/* ── Profil ─────────────────────────────────────────────────────────────── */
export type GraphProfile = { mail?: string | null; userPrincipalName?: string | null; displayName?: string | null };

export async function getProfile(accessToken: string): Promise<GraphProfile> {
  return graphJson<GraphProfile>(accessToken, "/me?$select=mail,userPrincipalName,displayName");
}

/* ── Dossiers ───────────────────────────────────────────────────────────── */
export type GraphFolder = { id: string; displayName: string; totalItemCount?: number; unreadItemCount?: number };

export async function listMailFolders(accountId: string): Promise<GraphFolder[]> {
  const { accessToken } = await getValidOutlookAccessToken(accountId);
  const data = await graphJson<{ value: GraphFolder[] }>(accessToken, "/me/mailFolders?$top=100&$select=id,displayName,totalItemCount,unreadItemCount");
  return data.value ?? [];
}

/* ── Messages ───────────────────────────────────────────────────────────── */
export type GraphEmailAddress = { name?: string; address?: string };
export type GraphMessage = {
  id: string;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  isRead?: boolean;
  hasAttachments?: boolean;
  internetMessageId?: string | null;
  from?: { emailAddress?: GraphEmailAddress } | null;
  toRecipients?: { emailAddress?: GraphEmailAddress }[] | null;
};

/** Liste les messages d'un dossier (par défaut INBOX), les plus récents d'abord. */
export async function listMessages(
  accessToken: string,
  opts: { folder?: string; top?: number; unreadOnly?: boolean } = {},
): Promise<GraphMessage[]> {
  const folder = opts.folder && opts.folder.toUpperCase() !== "INBOX" ? opts.folder : "inbox";
  const top = opts.top ?? 25;
  const select = "id,subject,bodyPreview,receivedDateTime,isRead,hasAttachments,internetMessageId,from,toRecipients";
  const filter = opts.unreadOnly ? "&$filter=isRead eq false" : "";
  const data = await graphJson<{ value: GraphMessage[] }>(
    accessToken,
    `/me/mailFolders/${encodeURIComponent(folder)}/messages?$top=${top}&$orderby=receivedDateTime desc&$select=${select}${filter}`,
  );
  return data.value ?? [];
}

export type GraphAttachment = {
  "@odata.type"?: string;
  id: string;
  name?: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
  contentBytes?: string; // base64 (fileAttachment)
};

export async function getMessageAttachments(accessToken: string, messageId: string): Promise<GraphAttachment[]> {
  const data = await graphJson<{ value: GraphAttachment[] }>(accessToken, `/me/messages/${messageId}/attachments`);
  return data.value ?? [];
}

export async function markMessageRead(accessToken: string, messageId: string): Promise<void> {
  await graphFetch(accessToken, `/me/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ isRead: true }),
  });
}

export async function deleteMessage(accessToken: string, messageId: string): Promise<void> {
  await graphFetch(accessToken, `/me/messages/${messageId}`, { method: "DELETE" });
}

/* ── Envoi (avec pièces jointes) ────────────────────────────────────────── */
export type GraphSendInput = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  attachments?: { filename: string; mimeType: string; contentBase64: string }[];
  inReplyToInternetMessageId?: string | null;
};

function toRecipients(list?: string): { emailAddress: { address: string } }[] {
  if (!list) return [];
  return list.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((address) => ({ emailAddress: { address } }));
}

export async function sendMail(accountId: string, msg: GraphSendInput): Promise<{ id: string }> {
  const { accessToken } = await getValidOutlookAccessToken(accountId);
  const message: Record<string, unknown> = {
    subject: msg.subject,
    body: { contentType: "HTML", content: msg.html },
    toRecipients: toRecipients(msg.to),
    ccRecipients: toRecipients(msg.cc),
    bccRecipients: toRecipients(msg.bcc),
  };
  if (msg.attachments && msg.attachments.length > 0) {
    message.attachments = msg.attachments.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.filename,
      contentType: a.mimeType,
      contentBytes: a.contentBase64,
    }));
  }
  // sendMail ne renvoie pas d'id (202 Accepted) : on synthétise une clé de fil.
  await graphFetch(accessToken, "/me/sendMail", {
    method: "POST",
    body: JSON.stringify({ message, saveToSentItems: true }),
  });
  return { id: msg.inReplyToInternetMessageId ?? `outlook-${Date.now()}` };
}

/* ── Agenda ─────────────────────────────────────────────────────────────── */
export type GraphEvent = {
  id: string;
  subject?: string | null;
  bodyPreview?: string | null;
  isAllDay?: boolean;
  start?: { dateTime?: string; date?: string; timeZone?: string } | null;
  end?: { dateTime?: string; date?: string; timeZone?: string } | null;
  location?: { displayName?: string } | null;
  isCancelled?: boolean;
  onlineMeeting?: { joinUrl?: string } | null;
  attendees?: { emailAddress?: GraphEmailAddress; status?: { response?: string } }[] | null;
};

export async function listEvents(accountId: string, fromISO?: string, toISO?: string): Promise<GraphEvent[]> {
  const { accessToken } = await getValidOutlookAccessToken(accountId);
  const select = "id,subject,bodyPreview,isAllDay,start,end,location,isCancelled,onlineMeeting,attendees";
  if (fromISO && toISO) {
    const data = await graphJson<{ value: GraphEvent[] }>(
      accessToken,
      `/me/calendarView?startDateTime=${encodeURIComponent(fromISO)}&endDateTime=${encodeURIComponent(toISO)}&$top=250&$select=${select}`,
    );
    return data.value ?? [];
  }
  const data = await graphJson<{ value: GraphEvent[] }>(accessToken, `/me/events?$top=250&$orderby=start/dateTime desc&$select=${select}`);
  return data.value ?? [];
}

/* ── Contacts ───────────────────────────────────────────────────────────── */
export type GraphContact = {
  id: string;
  displayName?: string | null;
  emailAddresses?: { address?: string; name?: string }[] | null;
  mobilePhone?: string | null;
  businessPhones?: string[] | null;
  companyName?: string | null;
};

export async function listContacts(accountId: string, top = 500): Promise<GraphContact[]> {
  const { accessToken } = await getValidOutlookAccessToken(accountId);
  const data = await graphJson<{ value: GraphContact[] }>(
    accessToken,
    `/me/contacts?$top=${top}&$select=id,displayName,emailAddresses,mobilePhone,businessPhones,companyName`,
  );
  return data.value ?? [];
}
