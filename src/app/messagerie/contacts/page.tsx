import {
  Briefcase,
  CheckCircle2,
  ContactRound,
  Mail,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatCard } from "@/components/ui/stat-card";
import { NoGmailState } from "@/components/messaging/no-gmail-state";
import { ContactsSyncButton } from "@/components/messaging/contacts-sync-button";
import { listEmailContacts } from "@/lib/messaging/email-contact-store";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { getCorrespondents } from "@/lib/paperless";
import { ContactsList } from "@/components/messaging/contacts-list";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";
import { firstParam, type PageSearchParams } from "@/lib/page-params";

export const dynamic = "force-dynamic";

type Filter = "all" | "suggested" | "linked" | "new" | "ignored";

function clampFilter(value: string | undefined): Filter {
  const valid: Filter[] = ["all", "suggested", "linked", "new", "ignored"];
  return (valid as string[]).includes(value ?? "") ? (value as Filter) : "all";
}

export default async function MessagerieContactsPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const filter = clampFilter(firstParam(params, "filter"));

  const account = await getActiveGmailAccount();
  if (!account) {
    return (
      <PageShell>
        <PageHeader
          breadcrumb={[
            { href: "/dashboard", label: "Accueil" },
            { href: "/messagerie", label: "Messagerie" },
            { label: "Contacts" },
          ]}
          backLink={{ href: "/messagerie", label: "Retour à la boîte" }}
          title="Contacts Google"
        />
        <NoGmailState oauthConfigured={Boolean(getGmailOAuthConfig())} />
      </PageShell>
    );
  }

  const [all, corrData] = await Promise.all([
    listEmailContacts(account.accountId),
    getCorrespondents({ page_size: 1000 }),
  ]);
  const correspondents = (corrData.results ?? []).map((c) => ({ id: Number(c.id), name: c.name }));
  const visible = all.filter((c) => c.status !== "ignored");
  const counts = {
    all: visible.length,
    suggested: all.filter((c) => c.status === "suggested").length,
    linked: all.filter((c) => c.status === "linked").length,
    new: all.filter((c) => c.status === "new").length,
    ignored: all.filter((c) => c.status === "ignored").length,
  };

  const filtered =
    filter === "all"
      ? visible
      : all.filter((c) =>
          filter === "suggested"
            ? c.status === "suggested"
            : filter === "linked"
            ? c.status === "linked"
            : filter === "ignored"
            ? c.status === "ignored"
            : c.status === "new",
        );

  const tabs = [
    { href: "/messagerie/contacts?filter=all", label: "Tous", count: counts.all },
    {
      href: "/messagerie/contacts?filter=suggested",
      label: "À valider",
      count: counts.suggested,
    },
    {
      href: "/messagerie/contacts?filter=linked",
      label: "Liés",
      count: counts.linked,
    },
    {
      href: "/messagerie/contacts?filter=new",
      label: "Nouveaux",
      count: counts.new,
    },
    {
      href: "/messagerie/contacts?filter=ignored",
      label: "Masqués",
      count: counts.ignored,
    },
  ];

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { href: "/messagerie", label: "Messagerie" },
          { label: "Contacts" },
        ]}
        backLink={{ href: "/messagerie", label: "Retour à la boîte" }}
        title="Contacts Google"
        description={`Boîte ${account.email} · ${counts.all} contact(s) synchronisé(s)`}
        actions={<ContactsSyncButton />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Contacts"
          value={counts.all}
          helper="Google + autres"
          icon={ContactRound}
          tone="blue"
        />
        <StatCard
          label="À valider"
          value={counts.suggested}
          helper="suggestions de matching"
          icon={Sparkles}
          tone="violet"
        />
        <StatCard
          label="Liés"
          value={counts.linked}
          helper="déjà rattachés à un correspondant"
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Nouveaux"
          value={counts.new}
          helper="à classer"
          icon={Mail}
          tone="amber"
        />
      </div>

      <SegmentedTabs tabs={tabs} activeHref={`/messagerie/contacts?filter=${filter}`} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard
          title={`Contacts (${filtered.length})`}
          description="Contacts importés depuis Google People."
          bodyClassName=""
        >
          {counts.all === 0 ? (
            <EmptyState
              icon={ContactRound}
              title="Aucun contact synchronisé"
              description="Lancez une synchronisation pour importer vos contacts Google."
            />
          ) : (
            <ContactsList initialContacts={filtered} correspondents={correspondents} />
          )}
        </SectionCard>

        <aside className="space-y-5">
          <RightRailCard title="À propos" icon={Briefcase} iconTone="blue">
            <p className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
              Les contacts sont récupérés depuis Google People API en lecture seule.
              Le matching automatique vers les correspondants Gedify est calculé
              à chaque synchronisation. Vous gardez le contrôle final.
            </p>
          </RightRailCard>
          <RightRailCard
            title="Bonnes pratiques"
            icon={Sparkles}
            iconTone="violet"
          >
            <ul className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <li>1. Synchronisez vos contacts Google.</li>
              <li>2. Validez les suggestions « À valider ».</li>
              <li>3. Créez les correspondants manquants depuis « Nouveaux ».</li>
              <li>4. La mémoire de correction améliorera les prochaines passes.</li>
            </ul>
          </RightRailCard>
        </aside>
      </div>
    </PageShell>
  );
}
