import "server-only";

import { listAccounts } from "@/lib/mail-connector/account-store";
import { listLogs } from "@/lib/mail-connector/log-store";
import { listSuppressedAttachments } from "@/lib/mail-connector/suppressed-attachments-store";
import { listMailDocumentLinks } from "@/lib/messaging/mail-document-links-store";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";
import { listHiddenSenders } from "@/lib/messaging/hidden-senders-store";
import { listScheduledEmails } from "@/lib/messaging/scheduled-email-store";
import { listGmailTokensPublic } from "@/lib/connectors/gmail/gmail-token-store";

/* ────────────────────────────────────────────────────────────────────────
   Rapport MAILS (Partie 12) pour la Santé GED. LECTURE SEULE.
   Comptes, dernier sync, erreurs, tokens expirés, liens mail↔document,
   contacts, expéditeurs masqués, pièces jointes supprimées, brouillons
   programmés. RÈGLE ABSOLUE : ne JAMAIS exposer de token.
   Tout est best-effort (mail souvent non configuré → 0 partout).
   ──────────────────────────────────────────────────────────────────────── */

export type MailReport = {
  accounts: { total: number; active: number; withError: number };
  lastSyncAt: string | null;
  syncErrors: number;
  tokensExpired: number;
  links: { total: number; imported: number; pending: number; error: number };
  contacts: number;
  hiddenSenders: number;
  suppressedAttachments: number;
  scheduledDrafts: number;
  generatedAt: string;
};

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export async function computeMailReport(): Promise<MailReport> {
  const [accounts, logs, links, contacts, hidden, suppressed, scheduled, tokens] = await Promise.all([
    safe(listAccounts(), []),
    safe(listLogs({}), []),
    safe(listMailDocumentLinks(), []),
    safe(listEmailContacts(), []),
    safe(listHiddenSenders(), []),
    safe(listSuppressedAttachments(), []),
    safe(listScheduledEmails(), []),
    safe(listGmailTokensPublic(), []),
  ]);

  const active = accounts.filter((a) => a.isActive).length;
  const withError = accounts.filter((a) => Boolean(a.lastError)).length;
  const lastSyncAt = accounts
    .map((a) => a.lastSyncAt)
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

  const syncErrors = logs.filter((l) => l.status === "error").length;
  const tokensExpired = tokens.filter((t) => t.expired === true).length;

  const links_total = links.length;
  const links_imported = links.filter((l) => l.status === "imported").length;
  const links_pending = links.filter((l) => l.status === "pending").length;
  const links_error = links.filter((l) => l.status === "error").length;

  const scheduledDrafts = scheduled.filter((e) => e.status === "scheduled").length;

  return {
    accounts: { total: accounts.length, active, withError },
    lastSyncAt,
    syncErrors,
    tokensExpired,
    links: { total: links_total, imported: links_imported, pending: links_pending, error: links_error },
    contacts: contacts.length,
    hiddenSenders: hidden.length,
    suppressedAttachments: suppressed.length,
    scheduledDrafts,
    generatedAt: new Date().toISOString(),
  };
}
