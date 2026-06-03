import "server-only";

import { listAccounts } from "./account-store";
import { isSecureStorageReady } from "./encryption";
import { countRecentErrors } from "./log-store";
import { getStorageDriver } from "./storage-paths";
import type { MailConnectorStatus } from "./types";

export async function getMailConnectorStatus(): Promise<MailConnectorStatus> {
  const accounts = await listAccounts();
  const active = accounts.filter((account) => account.isActive);
  const recentErrors = await countRecentErrors(24 * 60);
  const lastSyncAt = accounts
    .map((account) => account.lastSyncAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop() ?? null;
  const lastSuccessAt = accounts
    .map((account) => account.lastSuccessAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop() ?? null;

  return {
    configured: accounts.length,
    active: active.length,
    lastSyncAt,
    lastSuccessAt,
    recentErrors,
    secureStorageReady: isSecureStorageReady(),
    oauthGmailReady: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    oauthOutlookReady: Boolean(process.env.MICROSOFT_OAUTH_CLIENT_ID && process.env.MICROSOFT_OAUTH_CLIENT_SECRET),
    workerReady: Boolean(process.env.MAIL_CONNECTOR_SYNC_SECRET),
    storageDriver: getStorageDriver(),
  };
}
