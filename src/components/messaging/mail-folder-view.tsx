import { NoGmailState } from "@/components/messaging/no-gmail-state";
import { InboxClient } from "@/components/messaging/inbox-client";
import { MobileMails } from "@/components/mobile/mobile-mails";
import { loadThreads } from "@/lib/messaging/load-threads";
import { loadCorrespondentFilters } from "@/lib/messaging/correspondent-filters";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";

/**
 * Vue de dossier Gmail réutilisable (boîte de réception, envoyés, brouillons,
 * corbeille, spam, archives…). Le `query` est une recherche Gmail (`in:sent`,
 * `in:trash`, …) propagée à `InboxClient` pour que recherche + pagination
 * restent dans le bon dossier.
 */
export async function MailFolderView({
  query,
  title,
  subtitle,
  limit = 50,
}: {
  query: string;
  title: string;
  subtitle?: string;
  limit?: number;
}) {
  const [result, correspondents] = await Promise.all([loadThreads(query, limit), loadCorrespondentFilters()]);

  if (!result.connected) {
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

      {/* Bureau (≥ md) : liste complète type client mail */}
      <div className="hidden h-full flex-col md:flex">
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div>
          <h1 className="text-[15px] font-bold" style={{ color: "var(--text-main)" }}>
            {title}
          </h1>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            {subtitle ?? result.accountEmail}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <InboxClient
          key={query}
          initialThreads={result.threads}
          initialHiddenEmails={result.hiddenSenderEmails}
          linksByThread={result.linksByThread}
          initialNextPageToken={result.nextPageToken}
          attachmentsByThread={result.attachmentsByThread}
          query={query}
          correspondents={correspondents}
        />
      </div>
      </div>
    </>
  );
}
