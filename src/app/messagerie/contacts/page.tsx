import { ContactsWorkspace, type ContactVM } from "@/components/contacts/contacts-workspace";
import { computeEligibleContacts } from "@/lib/contacts/eligible-contacts";
import { getCorrespondents } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export default async function MessagerieContactsPage() {
  const [eligible, corrData] = await Promise.all([
    computeEligibleContacts().catch(() => ({ contacts: [] as Awaited<ReturnType<typeof computeEligibleContacts>>["contacts"] })),
    getCorrespondents({ page_size: 1000, ordering: "name" }).catch(() => ({ results: [] as Array<{ id: number; name: string; document_count?: number }> })),
  ]);

  const contacts: ContactVM[] = eligible.contacts.map((c) => ({
    id: c.id,
    name: c.displayName,
    organization: c.company,
    email: c.email,
    emails: c.email ? [c.email] : [],
    phone: null,
    source: "email",
    linkedEmailsCount: c.linkedEmailsCount,
    linkedGedDocumentsCount: c.linkedGedDocumentsCount,
    linkedDocumentIds: c.linkedDocumentIds,
    lastInteractionAt: c.lastInteractionAt,
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

  return <ContactsWorkspace contacts={contacts} correspondents={correspondents} />;
}
