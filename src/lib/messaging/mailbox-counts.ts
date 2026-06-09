import "server-only";

import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";
import { listGmailThreads } from "@/lib/connectors/gmail/gmail-api";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { searchEmailMessages } from "@/lib/messaging/email-message-store";
import { buildGmailExclusionSuffix } from "@/lib/messaging/mail-folder-inclusion";

/**
 * Compteurs « Courriels à traiter » par boîte connectée (§17).
 *
 * - Gmail : estimation du fournisseur (`resultSizeEstimate`) sur la requête
 *   à-traiter (hors système + exclusions de libellés du compte). C'est une
 *   ESTIMATION (comme l'affiche Gmail), pas un comptage exact.
 * - IMAP : nombre de messages indexés localement pour le compte.
 *
 * Cache mémoire court (TTL) : la barre de filtres lit ces compteurs à chaque
 * rendu — sans cache, on appellerait l'API Gmail à chaque fois. `invalidate`
 * est appelé à l'ajout/suppression d'un compte.
 */

const ATRAITER_QUERY = "-in:sent -in:draft -in:trash -in:spam -in:chats";
const TTL_MS = 5 * 60_000;

export type MailboxCount = { id: string; email: string; provider: "gmail" | "imap"; count: number };

let cache: { at: number; total: number; boxes: MailboxCount[] } | null = null;

export function invalidateMailboxCounts(): void {
  cache = null;
}

export async function getMailboxCounts(): Promise<{ total: number; boxes: MailboxCount[] }> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { total: cache.total, boxes: cache.boxes };
  }

  const [gmail, imapAll] = await Promise.all([
    listGmailAccounts().catch(() => []),
    listAccounts().catch(() => []),
  ]);

  const gmailCounts = await Promise.all(
    gmail.map(async (a): Promise<MailboxCount> => {
      try {
        const suffix = await buildGmailExclusionSuffix(a.accountId).catch(() => "");
        const res = await listGmailThreads(a.accountId, ATRAITER_QUERY + suffix, 1);
        return { id: a.accountId, email: a.email, provider: "gmail", count: res.resultSizeEstimate ?? 0 };
      } catch {
        return { id: a.accountId, email: a.email, provider: "gmail", count: 0 };
      }
    }),
  );

  const imap = imapAll.filter(
    (a) => (a.authType === "imap-password" || a.authType === "oauth-outlook") && a.isActive,
  );
  const indexed = imap.length > 0 ? await searchEmailMessages("", 3000).catch(() => []) : [];
  const imapCounts: MailboxCount[] = imap.map((a) => ({
    id: a.id,
    email: a.email,
    provider: "imap",
    count: indexed.filter((m) => m.accountId === a.id).length,
  }));

  const boxes = [...gmailCounts, ...imapCounts];
  const total = boxes.reduce((n, b) => n + b.count, 0);
  cache = { at: Date.now(), total, boxes };
  return { total, boxes };
}
