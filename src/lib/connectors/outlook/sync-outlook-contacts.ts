import "server-only";

import { bulkUpsertEmailContacts, listEmailContacts } from "@/lib/messaging/email-contact-store";
import type { EmailContactRecord } from "@/lib/messaging/email-types";
import { getAccountWithSecret } from "@/lib/mail-connector/account-store";
import { listContacts } from "./graph-api";

/* Importe les contacts du carnet d'adresses Microsoft (Graph /me/contacts) dans
   le magasin de contacts GEDify (email-contact-store), idempotent par
   resourceName. Réutilise le même magasin que les contacts Google/email. */

export type OutlookContactsResult = { ok: boolean; synced?: number; message?: string };

export async function syncOutlookContacts(accountId: string): Promise<OutlookContactsResult> {
  const account = await getAccountWithSecret(accountId);
  if (!account || account.authType !== "oauth-outlook") {
    return { ok: false, message: "Compte Microsoft introuvable." };
  }
  try {
    const contacts = await listContacts(accountId, 500);
    const existing = await listEmailContacts(accountId);
    const priorByResource = new Map(existing.map((c) => [c.resourceName, c]));
    const now = new Date().toISOString();

    const records: EmailContactRecord[] = [];
    for (const c of contacts) {
      const emails = (c.emailAddresses ?? []).map((e) => e.address).filter((a): a is string => Boolean(a));
      const primary = emails[0] ?? null;
      if (!primary && !c.displayName) continue;
      const resourceName = `outlook:${accountId}:${c.id}`;
      const prior = priorByResource.get(resourceName);
      records.push({
        resourceName,
        accountId,
        accountEmail: account.email,
        displayName: c.displayName ?? primary ?? "Contact",
        email: primary,
        emails,
        phone: c.mobilePhone ?? c.businessPhones?.[0] ?? null,
        organization: c.companyName ?? null,
        source: "imap_email",
        correspondentId: prior?.correspondentId ?? null,
        suggestedCorrespondentId: prior?.suggestedCorrespondentId ?? null,
        suggestedScore: prior?.suggestedScore ?? null,
        status: prior?.correspondentId ? "linked" : prior?.status ?? "new",
        updatedAt: now,
      });
    }

    await bulkUpsertEmailContacts(records);
    return { ok: true, synced: records.length };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
