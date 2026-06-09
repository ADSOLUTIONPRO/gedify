import "server-only";

import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { countMessagesByAccount } from "@/lib/messaging/email-message-store";

/**
 * Compteurs de messages PAR BOÎTE — chacun calculé indépendamment, depuis
 * l'index local des messages synchronisés (`email-message-store`) groupé par
 * `accountId`, pour TOUS les fournisseurs (Gmail, IMAP, Microsoft).
 *
 * Auparavant le compteur Gmail utilisait `resultSizeEstimate` de l'API Gmail,
 * une ESTIMATION grossière (souvent arrondie à l'identique d'un compte à
 * l'autre — d'où « 201 / 201 »). On compte désormais le nombre RÉEL de messages
 * indexés pour chaque `accountId` : aucune valeur globale n'est recopiée d'un
 * compte sur l'autre, et le total est la somme (les ids `${accountId}:${uid}`
 * sont uniques → pas de double comptage).
 */

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

  const [gmail, imapAll, counts] = await Promise.all([
    listGmailAccounts().catch(() => []),
    listAccounts().catch(() => []),
    countMessagesByAccount().catch(() => ({ byAccount: {} as Record<string, number>, total: 0 })),
  ]);
  const countFor = (accountId: string) => counts.byAccount[accountId] ?? 0;

  // Un compteur par compte Gmail, filtré sur SON accountId (jamais une valeur
  // partagée). Deux comptes Google restent strictement distincts.
  const gmailCounts: MailboxCount[] = gmail.map((a) => ({
    id: a.accountId,
    email: a.email,
    provider: "gmail",
    count: countFor(a.accountId),
  }));

  const imap = imapAll.filter(
    (a) => (a.authType === "imap-password" || a.authType === "oauth-outlook") && a.isActive,
  );
  const imapCounts: MailboxCount[] = imap.map((a) => ({
    id: a.id,
    email: a.email,
    provider: "imap",
    count: countFor(a.id),
  }));

  const boxes = [...gmailCounts, ...imapCounts];
  const total = boxes.reduce((n, b) => n + b.count, 0);
  cache = { at: Date.now(), total, boxes };
  return { total, boxes };
}
