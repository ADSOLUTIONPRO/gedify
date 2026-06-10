import { ContactsWorkspace, type ContactVM } from "@/components/contacts/contacts-workspace";
import { computeEligibleContacts } from "@/lib/contacts/eligible-contacts";
import { getCorrespondents } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export default async function MessagerieContactsPage() {
  const [eligible, corrData] = await Promise.all([
    computeEligibleContacts().catch(() => null),
    getCorrespondents({ page_size: 1000, ordering: "name" }).catch(() => ({ results: [] as Array<{ id: number; name: string; document_count?: number }> })),
  ]);

  const eligibleContacts = eligible?.contacts ?? [];
  const accountConnected = eligible?.report.accountConnected ?? false;
  const importedLinks = eligible?.report.importedLinks ?? 0;

  const contacts: ContactVM[] = eligibleContacts.map((c) => ({
    id: c.id,
    name: c.displayName,
    organization: c.company,
    email: c.email,
    emails: c.emails?.length ? c.emails : c.email ? [c.email] : [],
    phone: c.phone ?? null,
    address: c.address ?? null,
    notes: c.notes ?? null,
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

  return (
    <ContactsWorkspace
      contacts={contacts}
      correspondents={correspondents}
      accountConnected={accountConnected}
      importedLinks={importedLinks}
    />
  );
}
