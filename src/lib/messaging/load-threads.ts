import "server-only";

import { getGmailThread, listGmailThreads } from "@/lib/connectors/gmail/gmail-api";
import { getGmailOAuthConfig, isGmailReconnectError } from "@/lib/connectors/gmail/oauth";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { indexLinksByThread } from "@/lib/messaging/email-ged-link-store";
import { indexLinksByThread as indexAttachmentImportsByThread } from "@/lib/messaging/mail-document-links-store";
import { normaliseGmailThread } from "@/lib/messaging/gmail-normalize";
import { getHiddenSenderEmails } from "@/lib/messaging/hidden-senders-store";

/** Résumé d'import des pièces jointes d'un thread (pour le badge d'état). */
export type ThreadAttachmentSummary = { imported: number; error: boolean; docId: number | null };

export type NormalizedThread = NonNullable<Awaited<ReturnType<typeof normaliseGmailThread>>>;
export type LinksByThread = Awaited<ReturnType<typeof indexLinksByThread>>;

export type LoadThreadsResult =
  | { connected: false; oauthConfigured: boolean; needsReconnect?: boolean }
  | {
      connected: true;
      accountEmail: string;
      connectedAt: string;
      scopes: string[];
      threads: NormalizedThread[];
      linksByThread: LinksByThread;
      hiddenSenderEmails: string[];
      nextPageToken: string | null;
      attachmentsByThread: Map<string, ThreadAttachmentSummary>;
    };

type AttImports = Awaited<ReturnType<typeof indexAttachmentImportsByThread>>;

/** Construit le résumé d'import des PJ par thread (badge d'état + filtre « à traiter »). */
function buildAttachmentSummary(attImportsByThread: AttImports): Map<string, ThreadAttachmentSummary> {
  const map = new Map<string, ThreadAttachmentSummary>();
  for (const [threadId, importLinks] of attImportsByThread) {
    const imported = importLinks.filter((l) => l.status === "imported");
    map.set(threadId, {
      imported: imported.length,
      error: importLinks.some((l) => l.status === "error"),
      docId: imported.find((l) => l.paperlessDocumentId)?.paperlessDocumentId ?? null,
    });
  }
  return map;
}

/**
 * Charge les threads Gmail pour une requête donnée, côté serveur uniquement.
 * Filtre automatiquement les expéditeurs masqués dans la surcouche GED.
 */
export async function loadThreads(query = "in:inbox", limit = 40): Promise<LoadThreadsResult> {
  const account = await getActiveGmailAccount();
  if (!account) {
    return { connected: false, oauthConfigured: Boolean(getGmailOAuthConfig()) };
  }

  // L'appel Gmail peut échouer si le token est expiré/révoqué (invalid_grant) :
  // on dégrade vers un état « reconnexion » plutôt que de planter la page.
  let refs: Awaited<ReturnType<typeof listGmailThreads>>["threads"];
  let nextPageToken: string | undefined;
  try {
    const res = await listGmailThreads(account.accountId, query, limit);
    refs = res.threads;
    nextPageToken = res.nextPageToken;
  } catch (error) {
    return { connected: false, oauthConfigured: true, needsReconnect: isGmailReconnectError(error) };
  }

  const [linksByThread, hiddenEmails, attImportsByThread] = await Promise.all([
    indexLinksByThread(),
    getHiddenSenderEmails(),
    indexAttachmentImportsByThread(),
  ]);

  const attachmentsByThread = buildAttachmentSummary(attImportsByThread);

  const threads = (
    await Promise.all(
      refs.map(async (ref) => {
        try {
          const full = await getGmailThread(account.accountId, ref.id, "metadata");
          return normaliseGmailThread(full, { accountId: account.accountId, accountEmail: account.email });
        } catch {
          return null;
        }
      })
    )
  )
    .filter((t): t is NormalizedThread => t !== null)
    .filter((t) => {
      // Filtrer les threads dont l'expéditeur principal est masqué
      const senderEmail = t.participants[0]?.email?.toLowerCase();
      return !senderEmail || !hiddenEmails.has(senderEmail);
    });

  return {
    connected: true,
    accountEmail: account.email,
    connectedAt: account.connectedAt,
    scopes: account.scopes,
    threads,
    linksByThread,
    hiddenSenderEmails: [...hiddenEmails],
    nextPageToken: nextPageToken ?? null,
    attachmentsByThread,
  };
}

/**
 * Charge les threads ayant au moins une **liaison GED** enregistrée (scope thread) :
 * documents liés, classement dossier/projet, correspondant… (vue « Liés à la GED »).
 * Récupère directement les threads liés depuis le store — pas seulement ceux de l'inbox.
 */
export async function loadLinkedThreads(limit = 100): Promise<LoadThreadsResult> {
  const account = await getActiveGmailAccount();
  if (!account) {
    return { connected: false, oauthConfigured: Boolean(getGmailOAuthConfig()) };
  }

  const [linksByThread, hiddenEmails, attImportsByThread] = await Promise.all([
    indexLinksByThread(),
    getHiddenSenderEmails(),
    indexAttachmentImportsByThread(),
  ]);
  const attachmentsByThread = buildAttachmentSummary(attImportsByThread);
  const ids = [...linksByThread.keys()].slice(0, limit);

  // Pas de filtre « expéditeurs masqués » ici : un mail explicitement lié à la GED
  // doit rester visible même si son expéditeur est muté dans la boîte de réception.
  const threads = (
    await Promise.all(
      ids.map(async (id) => {
        try {
          const full = await getGmailThread(account.accountId, id, "metadata");
          return normaliseGmailThread(full, { accountId: account.accountId, accountEmail: account.email });
        } catch {
          return null;
        }
      })
    )
  ).filter((t): t is NormalizedThread => t !== null);

  return {
    connected: true,
    accountEmail: account.email,
    connectedAt: account.connectedAt,
    scopes: account.scopes,
    threads,
    linksByThread,
    hiddenSenderEmails: [...hiddenEmails],
    nextPageToken: null,
    attachmentsByThread,
  };
}
