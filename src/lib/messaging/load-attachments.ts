import "server-only";

import { getGmailThread, listGmailThreads } from "@/lib/connectors/gmail/gmail-api";
import { getGmailOAuthConfig, isGmailReconnectError } from "@/lib/connectors/gmail/oauth";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { normaliseGmailMessage } from "@/lib/messaging/gmail-normalize";
import { listMailDocumentLinks, type MailDocumentLinkStatus } from "@/lib/messaging/mail-document-links-store";

/** Origine des pièces jointes : reçues (INBOX) ou envoyées (SENT). */
export type AttachmentOrigin = "inbox" | "sent";

export type AttachmentRow = {
  /** Clé stable `mailId:attachmentId`. */
  key: string;
  /** Origine du mail source (onglet). */
  origin: AttachmentOrigin;
  threadId: string;
  mailId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  date: string | null;
  /** Correspondant pertinent : expéditeur (inbox) ou destinataire (sent). */
  personName: string;
  personEmail: string;
  subject: string | null;
  /** Titre du document GED lié (si importé) — pour la recherche par mot-clé. */
  documentTitle: string | null;
  /** État GED de la pièce jointe (Gedify mail-document-links-store). */
  status: MailDocumentLinkStatus | "none";
  documentId: number | null;
};

export type LoadAttachmentsResult =
  | { connected: false; oauthConfigured: boolean; needsReconnect?: boolean }
  | { connected: true; accountEmail: string; rows: AttachmentRow[]; nextPageToken: string | null };

/**
 * Liste à plat les pièces jointes des mails (reçus ou envoyés) avec leur état
 * GED, pour la page « Pièces jointes » (rendu type liste de mails).
 *
 * - `origin = "inbox"` : pièces jointes des messages reçus (label `INBOX`),
 *   correspondant = expéditeur.
 * - `origin = "sent"`  : pièces jointes des messages envoyés (label `SENT`),
 *   correspondant = destinataire.
 *
 * Nécessite le format Gmail `full` par thread (les parts ne sont pas exposées
 * en `metadata`). Renvoie `nextPageToken` pour le « Voir plus » par onglet.
 */
export async function loadAttachments(
  origin: AttachmentOrigin,
  limit = 25,
  pageToken?: string,
): Promise<LoadAttachmentsResult> {
  const account = await getActiveGmailAccount();
  if (!account) {
    return { connected: false, oauthConfigured: Boolean(getGmailOAuthConfig()) };
  }

  const baseQuery = origin === "sent" ? "in:sent has:attachment" : "in:inbox has:attachment";
  const wantLabel = origin === "sent" ? "SENT" : "INBOX";

  // L'appel Gmail peut échouer si le token est expiré/révoqué (invalid_grant).
  let refs: Awaited<ReturnType<typeof listGmailThreads>>["threads"];
  let nextPageToken: string | undefined;
  try {
    const res = await listGmailThreads(account.accountId, baseQuery, limit, pageToken);
    refs = res.threads;
    nextPageToken = res.nextPageToken;
  } catch (error) {
    return { connected: false, oauthConfigured: true, needsReconnect: isGmailReconnectError(error) };
  }

  const links = await listMailDocumentLinks({ accountId: account.accountId });

  const linkByKey = new Map(
    links.filter((l) => l.attachmentId).map((l) => [`${l.mailId}:${l.attachmentId}`, l]),
  );

  const rows: AttachmentRow[] = [];
  await Promise.all(
    refs.map(async (ref) => {
      try {
        const thread = await getGmailThread(account.accountId, ref.id, "full");
        for (const message of thread.messages ?? []) {
          const m = normaliseGmailMessage(message, { accountId: account.accountId, accountEmail: account.email });
          // On ne garde que les messages de l'origine voulue (un thread mixte
          // peut contenir à la fois des messages reçus et des réponses envoyées).
          if (!m.labelIds.includes(wantLabel)) continue;

          const person = origin === "sent" ? (m.to[0] ?? m.cc[0] ?? null) : m.from;
          const personName = person?.name ?? person?.email ?? "Inconnu";
          const personEmail = person?.email ?? "";

          for (const a of m.attachments) {
            if (a.inline) continue;
            const key = `${m.id}:${a.attachmentId}`;
            const link = linkByKey.get(key);
            rows.push({
              key,
              origin,
              threadId: ref.id,
              mailId: m.id,
              attachmentId: a.attachmentId,
              filename: a.filename,
              mimeType: a.mimeType,
              sizeBytes: a.size,
              date: m.date,
              personName,
              personEmail,
              subject: m.subject,
              documentTitle: link?.documentTitle ?? null,
              status: link ? link.status : "none",
              documentId: link?.paperlessDocumentId ?? null,
            });
          }
        }
      } catch {
        /* on saute le thread illisible plutôt que d'échouer toute la page */
      }
    }),
  );

  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { connected: true, accountEmail: account.email, rows, nextPageToken: nextPageToken ?? null };
}
