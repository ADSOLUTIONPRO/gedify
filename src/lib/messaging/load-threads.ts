import "server-only";

import { getGmailThread, listGmailThreads } from "@/lib/connectors/gmail/gmail-api";
import { getGmailOAuthConfig, isGmailReconnectError } from "@/lib/connectors/gmail/oauth";
import { getActiveGmailAccount, getInboxGmailAccounts } from "@/lib/messaging/active-gmail-account";
import type { GmailAccountSummary } from "@/lib/connectors/gmail/gmail-token-store";
import { indexLinksByThread } from "@/lib/messaging/email-ged-link-store";
import { indexLinksByThread as indexAttachmentImportsByThread } from "@/lib/messaging/mail-document-links-store";
import { normaliseGmailThread } from "@/lib/messaging/gmail-normalize";
import { getHiddenSenderEmails } from "@/lib/messaging/hidden-senders-store";
import { buildGmailExclusionSuffix } from "@/lib/messaging/mail-folder-inclusion";

/** Résumé d'import des pièces jointes d'un thread (pour le badge d'état). */
export type ThreadAttachmentSummary = { imported: number; error: boolean; docId: number | null };

export type NormalizedThread = NonNullable<Awaited<ReturnType<typeof normaliseGmailThread>>>;
export type LinksByThread = Awaited<ReturnType<typeof indexLinksByThread>>;

/** Comptes dont la synchronisation a échoué (affiché en bandeau discret). */
export type AccountSyncError = { email: string; reconnect: boolean };

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
      /** Boîtes en erreur lors de l'agrégation (les autres restent affichées). */
      accountErrors: AccountSyncError[];
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
 * Récupère + normalise les threads d'UN compte Google (refs → metadata).
 * Réutilisé par l'inbox SSR et la route API pour agréger plusieurs comptes.
 */
export async function fetchAccountThreads(
  account: GmailAccountSummary,
  query: string,
  limit: number,
  pageToken?: string,
): Promise<{ threads: NormalizedThread[]; nextPageToken: string | null }> {
  const res = await listGmailThreads(account.accountId, query, limit, pageToken);
  const threads = (
    await Promise.all(
      res.threads.map(async (ref) => {
        try {
          const full = await getGmailThread(account.accountId, ref.id, "metadata");
          return normaliseGmailThread(full, { accountId: account.accountId, accountEmail: account.email });
        } catch {
          return null;
        }
      }),
    )
  ).filter((t): t is NormalizedThread => t !== null);
  return { threads, nextPageToken: res.nextPageToken ?? null };
}

/** Tri unifié par date du dernier message (plus récent d'abord). */
function byLastMessageDesc(a: NormalizedThread, b: NormalizedThread): number {
  const da = a.lastMessageAt ?? "";
  const db = b.lastMessageAt ?? "";
  return da < db ? 1 : da > db ? -1 : 0;
}

/**
 * Charge les threads Gmail pour une requête donnée, côté serveur uniquement.
 *
 * Multi-comptes : par défaut (« Toutes les boîtes ») agrège les threads de TOUS
 * les comptes Google connectés (l'échec d'un compte n'impacte pas les autres),
 * fusionnés et triés par date. Un compte précis sélectionné → ce compte seul.
 * Filtre automatiquement les expéditeurs masqués dans la surcouche GED.
 */
export async function loadThreads(
  query = "in:inbox",
  limit = 40,
  opts: { excludeProcessed?: boolean; accountId?: string | null } = {},
): Promise<LoadThreadsResult> {
  const { aggregate, accounts } = await getInboxGmailAccounts(opts.accountId ?? null);
  if (accounts.length === 0) {
    console.log(`[mail] accountId=none folder=${query} (aucun compte Gmail actif → état « connecter Google » ou repli IMAP)`);
    return { connected: false, oauthConfigured: Boolean(getGmailOAuthConfig()) };
  }

  // Récupération par compte. Un token expiré/révoqué (invalid_grant) sur UN
  // compte ne fait pas planter les autres ; en mono-compte on dégrade en
  // « reconnexion » comme avant.
  const perAccount = await Promise.all(
    accounts.map(async (account) => {
      try {
        // « Courriels à traiter » : retire les libellés exclus manuellement (§13)
        // de CE compte (requête per-compte, pas globale).
        const accountQuery = opts.excludeProcessed
          ? query + (await buildGmailExclusionSuffix(account.accountId).catch(() => ""))
          : query;
        const { threads, nextPageToken } = await fetchAccountThreads(account, accountQuery, limit);
        return { account, threads, nextPageToken, error: false, reconnect: false };
      } catch (error) {
        const reconnect = isGmailReconnectError(error);
        console.log(`[mail] accountId=${account.accountId.slice(0, 6)}… folder=${query} apiReturned=ERROR reconnect=${reconnect} (${error instanceof Error ? error.message.slice(0, 80) : "?"})`);
        return { account, threads: [] as NormalizedThread[], nextPageToken: null as string | null, error: true, reconnect };
      }
    }),
  );

  if (!aggregate && perAccount.length === 1 && perAccount[0].error) {
    return { connected: false, oauthConfigured: true, needsReconnect: perAccount[0].reconnect };
  }

  const [linksByThread, hiddenEmails, attImportsByThread] = await Promise.all([
    indexLinksByThread(),
    getHiddenSenderEmails(),
    indexAttachmentImportsByThread(),
  ]);

  const attachmentsByThread = buildAttachmentSummary(attImportsByThread);

  const merged = perAccount
    .flatMap((p) => p.threads)
    .filter((t) => {
      const senderEmail = t.participants[0]?.email?.toLowerCase();
      return !senderEmail || !hiddenEmails.has(senderEmail);
    })
    .sort(byLastMessageDesc);

  // Exclure les conversations déjà « traitées » (liées GED / PJ importées) si demandé
  // → alimente le dossier logique « Courriels à traiter ».
  const processedIds = processedThreadIdSet(linksByThread, attachmentsByThread);
  let finalThreads = opts.excludeProcessed ? merged.filter((t) => !processedIds.has(t.id)) : merged;
  // En agrégé, on borne globalement après fusion (chaque compte a ramené jusqu'à `limit`).
  if (aggregate) finalThreads = finalThreads.slice(0, limit);

  // Pagination par compte uniquement en mono-compte (curseurs non fusionnables).
  const nextPageToken = !aggregate ? perAccount[0]?.nextPageToken ?? null : null;
  const primary = accounts[0];
  const accountEmail = aggregate && accounts.length > 1 ? `Toutes les boîtes (${accounts.length})` : primary.email;
  // Boîtes en erreur (token expiré/révoqué) : signalées sans masquer les autres.
  const accountErrors: AccountSyncError[] = perAccount
    .filter((p) => p.error)
    .map((p) => ({ email: p.account.email, reconnect: p.reconnect }));

  console.log(
    `[mail] accounts=${accounts.length} aggregate=${aggregate} folder=${query} apiReturned=${perAccount.reduce((n, p) => n + p.threads.length, 0)} displayedCount=${finalThreads.length} hiddenSenders=${hiddenEmails.size}`,
  );

  return {
    connected: true,
    accountEmail,
    connectedAt: primary.connectedAt,
    scopes: primary.scopes,
    threads: finalThreads,
    linksByThread,
    hiddenSenderEmails: [...hiddenEmails],
    nextPageToken,
    attachmentsByThread,
    accountErrors,
  };
}

/** Ensemble des threadIds « traités » = liés à la GED OU ayant une PJ importée. */
function processedThreadIdSet(
  linksByThread: LinksByThread,
  attachmentsByThread: Map<string, ThreadAttachmentSummary>,
): Set<string> {
  const ids = new Set<string>(linksByThread.keys());
  for (const [tid, s] of attachmentsByThread) if (s.imported > 0) ids.add(tid);
  return ids;
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
  // « Importés en GED » = conversations liées à la GED OU ayant une PJ importée.
  const ids = [...processedThreadIdSet(linksByThread, attachmentsByThread)].slice(0, limit);

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
    accountErrors: [],
  };
}
