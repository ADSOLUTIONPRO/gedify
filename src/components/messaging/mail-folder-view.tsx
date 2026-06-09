import { NoGmailState } from "@/components/messaging/no-gmail-state";
import { InboxTwoPane } from "@/components/messaging/inbox-two-pane";
import { ImapInboxView } from "@/components/messaging/imap-inbox-view";
import { MobileMails } from "@/components/mobile/mobile-mails";
import { loadThreads, loadLinkedThreads } from "@/lib/messaging/load-threads";
import { loadImapInbox } from "@/lib/messaging/load-imap-inbox";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";

/**
 * Vue de dossier Gmail réutilisable (boîte de réception, envoyés, brouillons,
 * corbeille, spam, archives…). Le `query` est une recherche Gmail (`in:sent`,
 * `in:trash`, …) propagée à `InboxTwoPane` (liste + volet de lecture) pour que
 * recherche + pagination restent dans le bon dossier.
 */
export async function MailFolderView({
  query,
  title,
  subtitle,
  limit = 50,
  source = "query",
  excludeProcessed = false,
  accountId = null,
}: {
  query: string;
  title: string;
  subtitle?: string;
  limit?: number;
  /** "processed" → dossier logique « Importés en GED » (liés GED / PJ importées). */
  source?: "query" | "processed";
  /** "query" : exclure les conversations déjà traitées (dossier « Courriels à traiter »). */
  excludeProcessed?: boolean;
  /** Filtre « Boîte mail » (id de compte ou "all"/null pour toutes). */
  accountId?: string | null;
}) {
  const result = source === "processed"
    ? await loadLinkedThreads(limit)
    : await loadThreads(query, limit, { excludeProcessed, accountId });

  if (!result.connected) {
    // Pas de compte Gmail : si une boîte IMAP est connectée, on affiche au moins
    // ses messages (lecture seule) au lieu de l'écran « connecter Google ».
    const imap = await loadImapInbox(100);
    if (imap.accounts.length > 0) {
      return <ImapInboxView data={imap} title={title} />;
    }
    return (
      <div className="p-6">
        <NoGmailState
          oauthConfigured={result.oauthConfigured ?? Boolean(getGmailOAuthConfig())}
          needsReconnect={result.needsReconnect}
        />
      </div>
    );
  }

  return (
    <>
      {/* Mobile (< md) : liste de cartes mail « app » */}
      <MobileMails threads={result.threads} attachmentsByThread={result.attachmentsByThread} query={query} />

      {/* Bureau (≥ md) : 2 volets (liste + lecture) — fidèle à la maquette */}
      <div className="hidden h-full min-h-0 md:block">
        <InboxTwoPane
          key={`${query}:${accountId ?? "all"}`}
          initialThreads={result.threads}
          initialHiddenEmails={result.hiddenSenderEmails}
          linksByThread={result.linksByThread}
          initialNextPageToken={result.nextPageToken}
          attachmentsByThread={result.attachmentsByThread}
          query={query}
          accountFilter={accountId ?? null}
          accountEmail={subtitle ?? result.accountEmail}
          folderLabel={title}
        />
      </div>
    </>
  );
}
