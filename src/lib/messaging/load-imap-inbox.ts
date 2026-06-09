import "server-only";

import { listAccounts } from "@/lib/mail-connector/account-store";
import { searchEmailMessages } from "@/lib/messaging/email-message-store";

/* ────────────────────────────────────────────────────────────────────────
   Boîte de réception IMAP (lecture seule).

   La messagerie « riche » (threads, ouverture, envoi) est branchée sur Gmail.
   Pour les comptes IMAP génériques (autre fournisseur), on affiche au moins les
   messages déjà synchronisés (indexés dans email-message-store par la synchro),
   afin que l'utilisateur RETROUVE ses mails après avoir ajouté la boîte.
   Aucune dépendance Gmail : sûr, n'altère pas le flux Google existant.
   ──────────────────────────────────────────────────────────────────────── */

export type ImapInboxItem = {
  id: string;
  accountEmail: string;
  from: string | null;
  subject: string | null;
  date: string | null;
  snippet: string;
  hasAttachments: boolean;
};

export type ImapInboxResult = {
  accounts: { id: string; email: string }[];
  items: ImapInboxItem[];
};

/** Comptes IMAP (mot de passe) actifs + leurs messages indexés, triés récents d'abord. */
export async function loadImapInbox(limit = 100): Promise<ImapInboxResult> {
  const accounts = (await listAccounts()).filter(
    (a) => (a.authType === "imap-password" || a.authType === "oauth-outlook") && a.isActive,
  );
  if (accounts.length === 0) return { accounts: [], items: [] };

  const emailById = new Map(accounts.map((a) => [a.id, a.email]));
  const all = await searchEmailMessages("", Math.max(limit * 3, 300));

  const items = all
    .filter((m) => emailById.has(m.accountId))
    .sort((a, b) => ((a.date ?? a.createdAt) < (b.date ?? b.createdAt) ? 1 : -1))
    .slice(0, limit)
    .map((m) => ({
      id: m.id,
      accountEmail: emailById.get(m.accountId) ?? "",
      from: m.from,
      subject: m.subject,
      date: m.date,
      snippet: (m.text ?? "").slice(0, 200),
      hasAttachments: m.hasAttachments,
    }));

  return {
    accounts: accounts.map((a) => ({ id: a.id, email: a.email })),
    items,
  };
}
