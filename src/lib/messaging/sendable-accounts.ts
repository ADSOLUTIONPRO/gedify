import "server-only";

import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";
import { listAccounts } from "@/lib/mail-connector/account-store";

/* Liste UNIFIÉE des boîtes mail connectées (Google OAuth + IMAP), tous
   fournisseurs au même niveau. Sert au sélecteur « Boîte active » / « Expéditeur »
   et au routage d'envoi. Aucun secret exposé. */

export type SendableAccountType = "gmail" | "imap";

export type SendableAccount = {
  id: string;
  email: string;
  name?: string;
  type: SendableAccountType;
  /** L'envoi est-il possible (Gmail OAuth = oui ; IMAP = oui si SMTP configuré). */
  canSend: boolean;
};

export async function listSendableAccounts(): Promise<SendableAccount[]> {
  const [gmail, imap] = await Promise.all([
    listGmailAccounts().catch(() => []),
    listAccounts().catch(() => []),
  ]);

  const g: SendableAccount[] = gmail.map((a) => ({
    id: a.accountId,
    email: a.email,
    type: "gmail",
    canSend: true,
  }));

  const i: SendableAccount[] = imap
    .filter((a) => (a.authType === "imap-password" || a.authType === "oauth-outlook") && a.isActive)
    .map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      type: "imap",
      canSend: Boolean(a.smtpHost),
    }));

  return [...g, ...i];
}

/** Compte d'envoi à utiliser : celui demandé (id), sinon le 1er capable d'envoyer. */
export async function resolveSendAccount(accountId?: string | null): Promise<SendableAccount | null> {
  const all = await listSendableAccounts();
  if (accountId) {
    const found = all.find((a) => a.id === accountId);
    if (found) return found;
  }
  return all.find((a) => a.canSend) ?? all[0] ?? null;
}
