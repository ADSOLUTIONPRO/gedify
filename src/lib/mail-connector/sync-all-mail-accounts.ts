import "server-only";

import { listAccounts } from "./account-store";
import { syncMailAccount } from "./sync-mail-account";
import type { MailSyncResult } from "./types";

export async function syncAllMailAccounts(): Promise<{
  total: number;
  results: MailSyncResult[];
}> {
  const accounts = await listAccounts();
  const active = accounts.filter((account) => account.isActive);
  const results: MailSyncResult[] = [];

  for (const account of active) {
    const result = await syncMailAccount(account.id);
    results.push(result);
  }

  return { total: active.length, results };
}
