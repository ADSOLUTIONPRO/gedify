import { Briefcase, ContactRound, Mail, Users, UserCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { ContactsSyncButton } from "@/components/messaging/contacts-sync-button";
import { ContactsEmailSyncButton } from "@/components/messaging/contacts-email-sync-button";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { getCorrespondents } from "@/lib/paperless";
import { ContactsList } from "@/components/messaging/contacts-list";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";
import { firstParam, type PageSearchParams } from "@/lib/page-params";
import type { EmailContactRecord } from "@/lib/messaging/email-types";

export const dynamic = "force-dynamic";

type Source = "all" | "google" | "imap_email" | "manual" | "correspondents";

function clampSource(value: string | undefined): Source {
  const valid: Source[] = ["all", "google", "imap_email", "manual", "correspondents"];
  return (valid as string[]).includes(value ?? "") ? (value as Source) : "all";
}

const isGoogle = (c: EmailContactRecord) => c.source === "people" || c.source === "other_contacts";

export default async function MessagerieContactsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const source = clampSource(firstParam(params, "source"));

  const account = await getActiveGmailAccount();
  const oauthConfigured = Boolean(getGmailOAuthConfig());

  // Correspondants GEDify (toujours visibles, même sans compte mail).
  const corrData = await getCorrespondents({ page_size: 1000 });
  const correspondents = (corrData.results ?? []).map((c) => ({
    id: Number(c.id),
    name: c.name,
    documentCount: typeof c.document_count === "number" ? c.document_count : null,
  }));

  // Contacts emails (Google + détectés), seulement si une boîte est connectée.
  const allContacts = account ? await listEmailContacts(account.accountId) : [];
  const visible = allContacts.filter((c) => c.status !== "ignored");

  const counts = {
    all: visible.length,
    google: visible.filter(isGoogle).length,
    imap_email: visible.filter((c) => c.source === "imap_email").length,
    manual: visible.filter((c) => c.source === "manual").length,
    correspondents: correspondents.length,
  };

  const tabs = [
    { href: "/messagerie/contacts?source=all", label: "Tous", count: counts.all },
    { href: "/messagerie/contacts?source=google", label: "Google", count: counts.google },
    { href: "/messagerie/contacts?source=imap_email", label: "Emails", count: counts.imap_email },
    { href: "/messagerie/contacts?source=manual", label: "Manuels", count: counts.manual },
    { href: "/messagerie/contacts?source=correspondents", label: "Correspondants GEDify", count: counts.correspondents },
  ];

  const emailContacts =
    source === "google" ? visible.filter(isGoogle)
    : source === "imap_email" ? visible.filter((c) => c.source === "imap_email")
    : source === "manual" ? visible.filter((c) => c.source === "manual")
    : visible;

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { href: "/messagerie", label: "Messagerie" },
          { label: "Contacts" },
        ]}
        backLink={{ href: "/messagerie", label: "Retour à la boîte" }}
        title="Contacts"
        description={account ? `Boîte ${account.email} · ${counts.all} contact(s) email · ${counts.correspondents} correspondant(s)` : `${counts.correspondents} correspondant(s) GEDify`}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <ContactsSyncButton />
            {account ? <ContactsEmailSyncButton /> : null}
          </div>
        }
      />

      <SegmentedTabs tabs={tabs} activeHref={`/messagerie/contacts?source=${source}`} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {source === "correspondents" ? (
            <SectionCard title={`Correspondants GEDify (${correspondents.length})`} description="Correspondants documentaires internes — source de classement de vos documents.">
              {correspondents.length === 0 ? (
                <EmptyState icon={Users} title="Aucun correspondant GEDify" description="Les correspondants sont créés au fil du classement de vos documents." />
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {correspondents.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                        <UserCircle className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold" style={{ color: "var(--text-main)" }}>{c.name}</p>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">Correspondant GEDify</span>
                      </div>
                      {c.documentCount != null ? (
                        <a href={`/documents?correspondent=${c.id}`} className="shrink-0 text-[11.5px] font-semibold underline" style={{ color: "#0B5CFF" }}>
                          {c.documentCount} doc(s)
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          ) : (
            <SectionCard
              title={`Contacts (${emailContacts.length})`}
              description={
                source === "google" ? "Contacts importés depuis Google People."
                : source === "imap_email" ? "Contacts détectés dans vos emails (expéditeurs / destinataires)."
                : source === "manual" ? "Contacts saisis manuellement."
                : "Tous les contacts emails (Google + détectés)."
              }
            >
              {!account ? (
                <EmptyState
                  icon={Mail}
                  title="Aucune boîte mail connectée"
                  description={oauthConfigured
                    ? "Connectez un compte Google pour synchroniser vos contacts. Les correspondants GEDify restent visibles dans l'onglet dédié."
                    : "OAuth Google n'est pas configuré côté serveur. Les correspondants GEDify restent visibles dans l'onglet dédié."}
                />
              ) : emailContacts.length === 0 ? (
                <EmptyState
                  icon={ContactRound}
                  title={
                    source === "google" ? "Aucun contact Google synchronisé"
                    : source === "imap_email" ? "Aucun contact détecté dans les emails"
                    : source === "manual" ? "Aucun contact manuel"
                    : "Aucun contact"
                  }
                  description={
                    source === "imap_email" ? "Cliquez sur « Détecter depuis les emails » pour analyser votre boîte."
                    : source === "google" ? "Cliquez sur « Synchroniser les contacts ». Si Google refuse l'accès, reconnectez votre compte avec l'autorisation Contacts."
                    : "Synchronisez vos contacts pour commencer."
                  }
                />
              ) : (
                <ContactsList initialContacts={emailContacts} correspondents={correspondents.map((c) => ({ id: c.id, name: c.name }))} />
              )}
            </SectionCard>
          )}
        </div>

        <aside className="space-y-5">
          <RightRailCard title="Sources de contacts" icon={ContactRound} iconTone="blue">
            <ul className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <li><strong style={{ color: "var(--text-main)" }}>Google</strong> — via People API (lecture seule).</li>
              <li><strong style={{ color: "var(--text-main)" }}>Emails</strong> — expéditeurs/destinataires détectés.</li>
              <li><strong style={{ color: "var(--text-main)" }}>Correspondants GEDify</strong> — issus du classement documentaire.</li>
            </ul>
          </RightRailCard>
          <RightRailCard title="Synchronisation Google" icon={Briefcase} iconTone="violet">
            <p className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
              Si la synchro Google échoue : vérifiez que la <strong>People API</strong> est activée dans Google Cloud,
              puis <strong>reconnectez</strong> le compte pour accorder l&apos;autorisation Contacts.
            </p>
          </RightRailCard>
        </aside>
      </div>
    </PageShell>
  );
}
