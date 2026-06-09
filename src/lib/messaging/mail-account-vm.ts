import "server-only";

import { listAccounts } from "@/lib/mail-connector/account-store";
import { getMailboxCounts } from "@/lib/messaging/mailbox-counts";
import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";

/** Vue unifiée d'une boîte mail connectée (Gmail OAuth + IMAP au même niveau). */
export type MailAccountStatus = "active" | "error" | "reconnect" | "disabled" | "pending";

export type MailAccountVM = {
  id: string;
  email: string;
  name: string;
  provider: string;
  providerLabel: string;
  isGmail: boolean;
  connector: "imap" | "gmail-oauth" | null;
  authType: string;
  authLabel: string;
  isActive: boolean;
  isDefault: boolean;
  canSend: boolean;
  color: string | null;
  syncIntervalMinutes: number;
  watchedFolder: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  messages: number | null;
  status: MailAccountStatus;
  scopes: string[];
  connectedAt: string | null;
};

function authLabel(account: { authType: string; connector: string | null }): string {
  if (account.connector === "gmail-oauth" || account.authType === "oauth-gmail") return "OAuth";
  if (account.authType === "oauth-outlook") return "OAuth Microsoft";
  return "IMAP / mot de passe";
}

/**
 * Construit la liste UNIFIÉE des boîtes pour la page Paramètres des Emails.
 * Une seule source (`listAccounts` inclut déjà les comptes Gmail OAuth) →
 * plus de duplication « Comptes connectés » vs « Comptes Google OAuth ».
 */
export async function buildMailAccountVMs(): Promise<MailAccountVM[]> {
  const [accounts, counts, gmail] = await Promise.all([
    listAccounts(),
    getMailboxCounts().catch(() => ({ total: 0, boxes: [] as { id: string; count: number }[] })),
    listGmailAccounts().catch(() => []),
  ]);
  const countById = new Map(counts.boxes.map((b) => [b.id, b.count] as const));
  const gmailById = new Map(gmail.map((g) => [g.accountId, g] as const));

  return accounts.map((a): MailAccountVM => {
    const isGmail = a.connector === "gmail-oauth" || a.authType === "oauth-gmail";
    const g = gmailById.get(a.id);
    const status: MailAccountStatus = !a.isActive
      ? "disabled"
      : a.lastError
        ? "error"
        : "active";
    return {
      id: a.id,
      email: a.email || a.gmailEmail || "",
      name: a.name,
      provider: a.provider,
      providerLabel: isGmail ? "Google (Gmail)" : "IMAP / SMTP",
      isGmail,
      connector: a.connector,
      authType: a.authType,
      authLabel: authLabel(a),
      isActive: a.isActive,
      isDefault: Boolean(a.isDefault),
      canSend: isGmail || Boolean(a.smtpHost),
      color: a.color ?? null,
      syncIntervalMinutes: a.syncIntervalMinutes,
      watchedFolder: a.watchedFolder || "INBOX",
      lastSyncAt: a.lastSyncAt,
      lastSuccessAt: a.lastSuccessAt,
      lastError: a.lastError,
      messages: countById.get(a.id) ?? null,
      status,
      scopes: g?.scopes ?? [],
      connectedAt: g?.connectedAt ?? a.createdAt,
    };
  });
}
