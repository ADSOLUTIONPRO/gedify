import "server-only";

import { getGmailThread, listGmailThreads } from "@/lib/connectors/gmail/gmail-api";
import { getGmailOAuthConfig, isGmailReconnectError } from "@/lib/connectors/gmail/oauth";
import { getActiveGmailAccount, getInboxGmailAccounts } from "@/lib/messaging/active-gmail-account";
import { type GmailAccountSummary, listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";
import { indexLinksByThread } from "@/lib/messaging/email-ged-link-store";
import { indexLinksByThread as indexAttachmentImportsByThread } from "@/lib/messaging/mail-document-links-store";
import { normaliseGmailThread, firstAddress } from "@/lib/messaging/gmail-normalize";
import { getHiddenSenderEmails } from "@/lib/messaging/hidden-senders-store";
import { buildGmailExclusionSuffix } from "@/lib/messaging/mail-folder-inclusion";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { searchEmailMessages, getEmailMessageById, type EmailMessageRecord as ImapIndexRecord } from "@/lib/messaging/email-message-store";

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
 * Messages IMAP indexés (autres fournisseurs : iCloud, La Poste…) convertis en
 * entrées de l'inbox unifiée (lecture seule, provider "imap"). Respecte le filtre
 * « Boîte mail » : `selected` = "all" → tous les comptes IMAP actifs ; sinon ce
 * compte précis (vide si la sélection est un compte Gmail).
 */
/** Convertit un message IMAP indexé en entrée de thread (lecture seule). */
function imapRecordToThread(m: ImapIndexRecord, accountEmail: string): NormalizedThread {
  const sender = firstAddress(m.from);
  return {
    id: m.id,
    accountId: m.accountId,
    accountEmail,
    provider: "imap",
    subject: m.subject,
    snippet: (m.text ?? "").slice(0, 200),
    lastMessageAt: m.date ?? m.createdAt,
    participants: sender ? [sender] : [],
    messageCount: 1,
    attachmentCount: m.hasAttachments ? 1 : 0,
    hasAttachments: m.hasAttachments,
    unread: false,
    important: false,
    labelIds: [],
  };
}

async function loadImapThreadRecords(selected: string, limit: number): Promise<NormalizedThread[]> {
  const imapAccounts = (await listAccounts()).filter((a) => a.authType === "imap-password" && a.isActive);
  if (imapAccounts.length === 0) return [];
  const targets = selected === "all" ? imapAccounts : imapAccounts.filter((a) => a.id === selected);
  if (targets.length === 0) return [];

  const emailById = new Map(targets.map((a) => [a.id, a.email]));
  const all = await searchEmailMessages("", Math.max(limit * 3, 300));
  return all
    .filter((m) => emailById.has(m.accountId))
    .sort((a, b) => ((a.date ?? a.createdAt) < (b.date ?? b.createdAt) ? 1 : -1))
    .slice(0, limit)
    .map((m) => imapRecordToThread(m, emailById.get(m.accountId) ?? ""));
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
  const { aggregate, accounts, selected } = await getInboxGmailAccounts(opts.accountId ?? null);

  // IMAP unifié (lecture seule) : injecté UNIQUEMENT dans « Courriels à traiter »
  // (excludeProcessed). Les autres dossiers (Envoyés/Brouillons…) restent Gmail.
  const imapThreads = opts.excludeProcessed
    ? await loadImapThreadRecords(selected, limit).catch(() => [] as NormalizedThread[])
    : [];

  if (accounts.length === 0 && imapThreads.length === 0) {
    console.log(`[mail] accountId=none folder=${query} (aucun compte actif → état « connecter Google » ou repli IMAP)`);
    return { connected: false, oauthConfigured: Boolean(getGmailOAuthConfig()) };
  }

  // Récupération Gmail par compte. Un token expiré/révoqué (invalid_grant) sur UN
  // compte ne fait pas planter les autres ; en mono-compte (sans IMAP) on dégrade
  // en « reconnexion » comme avant.
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

  if (!aggregate && accounts.length === 1 && perAccount[0]?.error && imapThreads.length === 0) {
    return { connected: false, oauthConfigured: true, needsReconnect: perAccount[0].reconnect };
  }

  const [linksByThread, hiddenEmails, attImportsByThread] = await Promise.all([
    indexLinksByThread(),
    getHiddenSenderEmails(),
    indexAttachmentImportsByThread(),
  ]);

  const attachmentsByThread = buildAttachmentSummary(attImportsByThread);
  const processedIds = processedThreadIdSet(linksByThread, attachmentsByThread);

  const merged = [...perAccount.flatMap((p) => p.threads), ...imapThreads]
    .filter((t) => {
      const senderEmail = t.participants[0]?.email?.toLowerCase();
      return !senderEmail || !hiddenEmails.has(senderEmail);
    })
    .sort(byLastMessageDesc);

  // Exclure les conversations déjà « traitées » (liées GED / PJ importées) si demandé.
  let finalThreads = opts.excludeProcessed ? merged.filter((t) => !processedIds.has(t.id)) : merged;
  // Borne globale après fusion dès qu'il y a agrégation (multi-Gmail ou IMAP injecté).
  if (aggregate || imapThreads.length > 0) finalThreads = finalThreads.slice(0, limit);

  // Pagination par curseur seulement en mono-compte Gmail strict (pas de fusion).
  const singleGmail = !aggregate && accounts.length === 1 && imapThreads.length === 0;
  const nextPageToken = singleGmail ? perAccount[0]?.nextPageToken ?? null : null;

  const imapBoxes = new Set(imapThreads.map((t) => t.accountId)).size;
  const totalBoxes = accounts.length + imapBoxes;
  const primary = accounts[0];
  const accountEmail = totalBoxes <= 1 ? primary?.email ?? imapThreads[0]?.accountEmail ?? "" : `Toutes les boîtes (${totalBoxes})`;
  // Boîtes Gmail en erreur (token expiré/révoqué) : signalées sans masquer les autres.
  const accountErrors: AccountSyncError[] = perAccount
    .filter((p) => p.error)
    .map((p) => ({ email: p.account.email, reconnect: p.reconnect }));

  console.log(
    `[mail] gmail=${accounts.length} imap=${imapBoxes} aggregate=${aggregate} folder=${query} displayedCount=${finalThreads.length} hiddenSenders=${hiddenEmails.size}`,
  );

  return {
    connected: true,
    accountEmail,
    connectedAt: primary?.connectedAt ?? new Date().toISOString(),
    scopes: primary?.scopes ?? [],
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
 * « Importés en GED » — conversations liées à la GED OU avec PJ importée, TOUS
 * comptes confondus. Chaque thread est récupéré depuis SON compte d'origine
 * (l'`accountId` est enregistré dans les liens) : Gmail → API metadata ;
 * IMAP → index local (lecture seule). Les threads sans compte connu retombent
 * sur le compte Gmail actif (compat liens anciens).
 */
export async function loadLinkedThreads(limit = 100): Promise<LoadThreadsResult> {
  const [linksByThread, hiddenEmails, attImportsByThread] = await Promise.all([
    indexLinksByThread(),
    getHiddenSenderEmails(),
    indexAttachmentImportsByThread(),
  ]);
  const attachmentsByThread = buildAttachmentSummary(attImportsByThread);
  const ids = [...processedThreadIdSet(linksByThread, attachmentsByThread)].slice(0, limit);

  const [gmailAccounts, allAccounts] = await Promise.all([listGmailAccounts(), listAccounts()]);
  const fallbackGmail = await getActiveGmailAccount();
  const hasAnyAccount = gmailAccounts.length > 0 || allAccounts.some((a) => a.authType === "imap-password" && a.isActive);
  if (!hasAnyAccount) {
    return { connected: false, oauthConfigured: Boolean(getGmailOAuthConfig()) };
  }

  const gmailEmail = new Map(gmailAccounts.map((a) => [a.accountId, a.email] as const));
  const imapAccounts = allAccounts.filter((a) => a.authType === "imap-password" && a.isActive);
  const imapEmail = new Map(imapAccounts.map((a) => [a.id, a.email] as const));

  // Compte propriétaire de chaque thread (import PJ d'abord — accountId requis —,
  // puis lien GED — accountId optionnel sur les anciens liens).
  const accountByThread = new Map<string, string>();
  for (const [tid, links] of attImportsByThread) {
    const a = links.find((l) => l.accountId)?.accountId;
    if (a) accountByThread.set(tid, a);
  }
  for (const [tid, links] of linksByThread) {
    if (accountByThread.has(tid)) continue;
    const a = links.find((l) => l.accountId)?.accountId;
    if (a) accountByThread.set(tid, a);
  }

  // Pas de filtre « expéditeurs masqués » : un mail explicitement lié à la GED
  // reste visible même si son expéditeur est muté dans la boîte de réception.
  const threads = (
    await Promise.all(
      ids.map(async (id): Promise<NormalizedThread | null> => {
        const accId = accountByThread.get(id);
        // Message IMAP → index local.
        if (accId && imapEmail.has(accId)) {
          const rec = await getEmailMessageById(id).catch(() => null);
          return rec ? imapRecordToThread(rec, imapEmail.get(accId) ?? "") : null;
        }
        // Gmail : compte résolu, sinon repli sur le compte actif (liens anciens).
        const gAcc = accId && gmailEmail.has(accId) ? accId : fallbackGmail?.accountId ?? null;
        if (!gAcc) return null;
        try {
          const full = await getGmailThread(gAcc, id, "metadata");
          return normaliseGmailThread(full, { accountId: gAcc, accountEmail: gmailEmail.get(gAcc) ?? fallbackGmail?.email ?? "" });
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((t): t is NormalizedThread => t !== null)
    .sort(byLastMessageDesc);

  const totalBoxes = gmailAccounts.length + imapAccounts.length;
  return {
    connected: true,
    accountEmail: totalBoxes > 1 ? `Toutes les boîtes (${totalBoxes})` : fallbackGmail?.email ?? imapAccounts[0]?.email ?? "",
    connectedAt: fallbackGmail?.connectedAt ?? new Date().toISOString(),
    scopes: fallbackGmail?.scopes ?? [],
    threads,
    linksByThread,
    hiddenSenderEmails: [...hiddenEmails],
    nextPageToken: null,
    attachmentsByThread,
    accountErrors: [],
  };
}
