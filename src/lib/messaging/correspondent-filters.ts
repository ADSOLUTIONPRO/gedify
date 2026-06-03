import "server-only";

import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";
import { getCorrespondents } from "@/lib/paperless";

export type CorrespondentFilter = { id: number; name: string; emails: string[] };

/**
 * Liste des correspondants GED disposant d'au moins une adresse email (via les
 * contacts Google liés), pour le filtre « Correspondant » de la boîte de réception.
 */
export async function loadCorrespondentFilters(): Promise<CorrespondentFilter[]> {
  const account = await getActiveGmailAccount();
  if (!account) return [];

  const [contacts, corr] = await Promise.all([
    listEmailContacts(account.accountId),
    getCorrespondents({ page_size: 1000 }),
  ]);
  const nameById = new Map((corr.results ?? []).map((c) => [Number(c.id), c.name]));

  const emailsById = new Map<number, Set<string>>();
  for (const c of contacts) {
    if (!c.correspondentId) continue;
    const emails = [c.email, ...(c.emails ?? [])].filter((e): e is string => Boolean(e));
    if (emails.length === 0) continue;
    const set = emailsById.get(c.correspondentId) ?? new Set<string>();
    emails.forEach((e) => set.add(e.toLowerCase()));
    emailsById.set(c.correspondentId, set);
  }

  return [...emailsById.entries()]
    .map(([id, emails]) => ({ id, name: nameById.get(id) ?? `Correspondant #${id}`, emails: [...emails] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
