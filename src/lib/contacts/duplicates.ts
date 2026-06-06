import type { EmailContactRecord } from "@/lib/messaging/email-types";

export type DuplicateGroup = { key: string; contacts: EmailContactRecord[] };

/**
 * Regroupe les contacts partageant une adresse email normalisée (≥ 2 contacts).
 * Base de la section « Doublons possibles » (fusion sur confirmation uniquement).
 */
export function findDuplicateGroups(contacts: EmailContactRecord[]): DuplicateGroup[] {
  const byEmail = new Map<string, EmailContactRecord[]>();
  for (const c of contacts) {
    if (c.status === "ignored") continue;
    const emails = new Set<string>();
    if (c.email) emails.add(c.email.toLowerCase());
    for (const e of c.emails ?? []) if (e) emails.add(e.toLowerCase());
    for (const e of emails) {
      const list = byEmail.get(e) ?? [];
      list.push(c);
      byEmail.set(e, list);
    }
  }
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();
  for (const [key, list] of byEmail) {
    const uniq = Array.from(new Map(list.map((c) => [c.resourceName, c])).values());
    if (uniq.length < 2) continue;
    const sig = uniq.map((c) => c.resourceName).sort().join("|");
    if (seen.has(sig)) continue; // même groupe atteint via plusieurs emails
    seen.add(sig);
    groups.push({ key, contacts: uniq });
  }
  return groups;
}
