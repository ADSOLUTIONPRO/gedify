import { ContactsWorkspace, type ContactVM } from "@/components/contacts/contacts-workspace";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";
import { getCorrespondents } from "@/lib/paperless";
import { findDuplicateGroups } from "@/lib/contacts/duplicates";
import type { EmailContactRecord } from "@/lib/messaging/email-types";

export const dynamic = "force-dynamic";

function mapSource(s: EmailContactRecord["source"]): ContactVM["source"] {
  if (s === "people" || s === "other_contacts") return "google";
  if (s === "imap_email") return "imap_email";
  return "manual";
}

export default async function MessagerieContactsPage() {
  const [allContacts, corrData] = await Promise.all([
    listEmailContacts(),
    getCorrespondents({ page_size: 1000, ordering: "name" }),
  ]);

  const visible = allContacts.filter((c) => c.status !== "ignored");

  const contacts: ContactVM[] = visible.map((c) => ({
    id: c.resourceName,
    name: c.displayName,
    organization: c.organization,
    email: c.email,
    emails: c.emails && c.emails.length ? c.emails : c.email ? [c.email] : [],
    phone: c.phone,
    source: mapSource(c.source),
    address: c.address ?? null,
    notes: c.notes ?? null,
    correspondentId: c.correspondentId,
  }));

  const correspondents: ContactVM[] = (corrData.results ?? []).map((c) => ({
    id: `corr:${c.id}`,
    name: c.name,
    organization: null,
    email: null,
    emails: [],
    phone: null,
    source: "correspondent",
    correspondentId: Number(c.id),
    documentCount: typeof c.document_count === "number" ? c.document_count : null,
  }));

  const duplicateIds = findDuplicateGroups(visible).flatMap((g) => g.contacts.map((c) => c.resourceName));

  return <ContactsWorkspace contacts={contacts} correspondents={correspondents} duplicateIds={duplicateIds} />;
}
