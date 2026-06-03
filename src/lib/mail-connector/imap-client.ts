import "server-only";

import { ImapFlow } from "imapflow";
import type { MailAccount, MailEncryption } from "./types";

function buildSecureOption(encryption: MailEncryption): boolean {
  return encryption === "tls";
}

export function buildImapConfig(
  account: Pick<MailAccount, "imapHost" | "imapPort" | "encryption" | "username">,
  password: string,
) {
  return {
    host: account.imapHost,
    port: account.imapPort,
    secure: buildSecureOption(account.encryption),
    auth: {
      user: account.username,
      pass: password,
    },
    logger: false as const,
    tls: account.encryption === "starttls" ? { rejectUnauthorized: true } : undefined,
  };
}

export async function withImap<T>(
  account: Pick<MailAccount, "imapHost" | "imapPort" | "encryption" | "username">,
  password: string,
  handler: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow(buildImapConfig(account, password));
  await client.connect();
  try {
    return await handler(client);
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }
}
