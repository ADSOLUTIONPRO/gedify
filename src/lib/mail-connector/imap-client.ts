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
    // Évite qu'un test/synchro reste bloqué indéfiniment sur un serveur lent ou
    // injoignable : la connexion (TCP + TLS + bannière + LOGIN) doit aboutir
    // dans ces délais, sinon ImapFlow rejette avec une erreur réseau claire.
    connectionTimeout: 20000,
    greetingTimeout: 12000,
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
