import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileBox,
  Inbox,
  Mail,
  PenSquare,
  Plug,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { CompactCard } from "@/components/ui/compact-card";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { PROVIDERS } from "@/lib/mail-connector/providers";
import { getMailConnectorStatus } from "@/lib/mail-connector/status";
import type { MailAccount } from "@/lib/mail-connector/types";
import { SignaturesManager } from "@/components/messaging/signatures-manager";
import { GmailAccountsManager } from "@/components/messaging/gmail-accounts-manager";
import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";
import { listSignatures } from "@/lib/messaging/email-signature-store";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";

export const dynamic = "force-dynamic";

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Il y a ${hours} h`;
  return date.toLocaleDateString("fr-FR");
}

export default async function EmailsPage() {
  const oauthConfig = getGmailOAuthConfig();
  const [accounts, status, gmailAccounts, signatures] = await Promise.all([
    listAccounts(),
    getMailConnectorStatus(),
    listGmailAccounts(),
    listSignatures(),
  ]);

  const recentImports = accounts
    .filter((a) => a.lastSyncAt)
    .sort((a, b) => (a.lastSyncAt! < b.lastSyncAt! ? 1 : -1))
    .slice(0, 5);

  return (
    <PageShell>
      <PageHeader
        compact
        backLink={{ href: "/administration", label: "Administration" }}
        breadcrumb={[
          { href: "/administration", label: "Administration" },
          { label: "Emails & Connecteurs" },
        ]}
        title="Emails & Connecteurs"
        description="Connectez une boîte à la fois, prévisualisez, puis activez l'import."
        actions={
          <>
            <Link
              href="/emails/connecter"
              className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--blue-600)" }}
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Connecter une boîte
            </Link>
          </>
        }
      />

      {!status.secureStorageReady ? (
        <div
          className="flex items-start gap-3 rounded-2xl p-4"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(245,158,11,0.15)", color: "#B45309" }}
          >
            <ShieldAlert className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-bold" style={{ color: "#92400E" }}>
              Stockage sécurisé à connecter
            </p>
            <p className="mt-1 leading-snug" style={{ color: "#78350F" }}>
              Définissez{" "}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs">
                MAIL_CONNECTOR_KEY
              </code>{" "}
              côté serveur pour activer le chiffrement AES-256-GCM des mots de passe IMAP.
            </p>
          </div>
        </div>
      ) : null}

      <CompactCard title="Mise en place mail progressive">
        <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-4">
          <p>1. Connecter Gmail ou IMAP.</p>
          <p>2. Choisir les dossiers à scanner.</p>
          <p>3. Exclure spam, corbeille et promotions.</p>
          <p>4. Prévisualiser avant import massif.</p>
        </div>
      </CompactCard>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Comptes connectés"
          value={status.configured}
          helper={`${status.active} actif(s)`}
          icon={Inbox}
          tone="blue"
        />
        <StatCard
          label="Dernière synchro"
          value={status.lastSyncAt ? formatRelative(status.lastSyncAt) : "—"}
          helper={
            status.lastSuccessAt
              ? `Succès : ${formatRelative(status.lastSuccessAt)}`
              : "Aucune"
          }
          icon={Sparkles}
          tone="violet"
        />
        <StatCard
          label="Erreurs (24h)"
          value={status.recentErrors}
          helper={status.recentErrors === 0 ? "Aucune erreur" : "Voir les logs"}
          icon={AlertTriangle}
          tone={status.recentErrors === 0 ? "emerald" : "amber"}
        />
        <StatCard
          label="OAuth Gmail / Outlook"
          value={
            status.oauthGmailReady || status.oauthOutlookReady ? "Partiel" : "À connecter"
          }
          helper="variables serveur requises"
          icon={Plug}
          tone="amber"
        />
      </div>

      {/* Connected accounts */}
      <SectionCard
        title="Comptes connectés"
        description={`${accounts.length} boîte(s) surveillée(s)`}
        bodyClassName="p-5"
      >
        {accounts.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: "rgba(11,92,255,0.04)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
              Aucune boîte connectée
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Connectez une boîte pour démarrer l&apos;import automatique des pièces jointes.
            </p>
            <Link
              href="/emails/connecter"
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--blue-600)" }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              Connecter une boîte
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <AccountTile key={account.id} account={account} />
            ))}
            <Link
              href="/emails/connecter"
              className="flex items-center gap-3 rounded-xl border bg-white p-4 transition hover:shadow-md"
              style={{ borderColor: "var(--border)", borderStyle: "dashed" }}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "rgba(11,92,255,0.10)" }}
              >
                <Plus
                  className="h-5 w-5"
                  style={{ color: "var(--blue-600)" }}
                  strokeWidth={2}
                />
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                  Connecter une boîte
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Gmail, Outlook, IMAP…
                </p>
              </div>
            </Link>
          </div>
        )}
      </SectionCard>

      {/* Comptes Google (OAuth) — fusionné depuis l'ancien /messagerie/parametres */}
      <SectionCard
        title={`Comptes Google (OAuth) — ${gmailAccounts.length}`}
        icon={Mail}
        description="Connexion Gmail via OAuth (envoi, lecture). Reconnectez si les autorisations changent."
        bodyClassName="p-5"
      >
        <GmailAccountsManager
          accounts={gmailAccounts.map((a) => ({ accountId: a.accountId, email: a.email, connectedAt: a.connectedAt }))}
        />
      </SectionCard>

      {/* Envoi — Signatures mail */}
      <SectionCard
        title="Signatures mail"
        icon={PenSquare}
        description="Signatures réutilisables insérées en bas de vos nouveaux mails et réponses."
        bodyClassName="p-5"
      >
        <SignaturesManager initial={signatures} />
      </SectionCard>

      {/* Sécurité — OAuth Google */}
      <SectionCard title="Sécurité — OAuth Google" icon={ShieldCheck} bodyClassName="p-5">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>Statut OAuth Google</span>
            <StatusPill tone={oauthConfig ? "emerald" : "amber"} dot>
              {oauthConfig ? "Configuré" : "À configurer"}
            </StatusPill>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span style={{ color: "var(--text-muted)" }}>Redirect URI</span>
            <span className="truncate font-mono text-[11px]" style={{ color: "var(--text-main)" }}>{oauthConfig?.redirectUri ?? "—"}</span>
          </li>
          <li className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>Scopes Google</span>
            <span className="text-[11px]" style={{ color: "var(--text-main)" }}>{oauthConfig?.scopes.length ?? 0} scope(s)</span>
          </li>
          <li className="pt-1 text-[11.5px] leading-snug" style={{ color: "var(--text-muted)" }}>
            Identifiants chiffrés côté serveur · aucun mot de passe stocké en clair.
          </li>
        </ul>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <SectionCard
          title="Fournisseurs disponibles"
          description="Choisissez votre fournisseur pour démarrer la configuration."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.map((provider) => (
              <Link
                key={provider.id}
                href={`/emails/connecter?provider=${provider.id}`}
                className="group rounded-xl bg-white p-4 transition hover:shadow-md"
                style={{ border: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                    {provider.name}
                  </p>
                  <ProviderStatusBadge status={provider.status} />
                </div>
                <p
                  className="mt-1.5 text-xs leading-snug"
                  style={{ color: "var(--text-muted)" }}
                >
                  {provider.description}
                </p>
                <p
                  className="mt-2 break-words font-mono text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {provider.defaultImapHost || "Hôte à saisir"}
                </p>
              </Link>
            ))}
          </div>
        </SectionCard>

        <aside className="space-y-5">
          <RightRailCard
            title="Imports récents"
            icon={FileBox}
            iconTone="emerald"
            ctaHref="/emails/logs"
            ctaLabel="Voir tous"
            bodyClassName="space-y-2"
          >
            {recentImports.length === 0 ? (
              <p className="py-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Aucune synchronisation récente.
              </p>
            ) : (
              recentImports.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold" style={{ color: "var(--text-main)" }}>
                      {account.email}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {account.provider}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {formatRelative(account.lastSyncAt)}
                  </span>
                </div>
              ))
            )}
          </RightRailCard>

          <RightRailCard title="Comment ça marche" icon={Mail} iconTone="blue">
            <ul className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--blue-600)" }}
                />
                Connectez votre boîte (IMAP ou OAuth).
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--blue-600)" }}
                />
                Définissez les règles d&apos;import et de classement.
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--blue-600)" }}
                />
                Les pièces jointes sont importées dans la GED.
              </li>
            </ul>
          </RightRailCard>
        </aside>
      </div>
    </PageShell>
  );
}

function AccountTile({ account }: { account: MailAccount }) {
  return (
    <Link
      href={`/emails/comptes/${account.id}`}
      className="rounded-xl bg-white p-4 transition hover:shadow-md"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "rgba(11,92,255,0.08)", color: "var(--blue-600)" }}
          >
            <Mail className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>
              {account.name || account.email}
            </p>
            <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
              {account.email}
            </p>
          </div>
        </div>
        <StatusPill tone={account.isActive ? "emerald" : "slate"} dot>
          {account.isActive ? "Actif" : "Pause"}
        </StatusPill>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span>Provider: <strong style={{ color: "var(--text-main)" }}>{account.provider}</strong></span>
        <span>Auth: <strong style={{ color: "var(--text-main)" }}>{account.authType}</strong></span>
        <span>Sync: <strong style={{ color: "var(--text-main)" }}>{account.syncIntervalMinutes}m</strong></span>
        <span>Dossier: <strong style={{ color: "var(--text-main)" }}>{account.watchedFolder || "INBOX"}</strong></span>
      </div>
    </Link>
  );
}

function ProviderStatusBadge({
  status,
}: {
  status: "available" | "preview" | "coming-soon";
}) {
  if (status === "available") {
    return (
      <StatusPill tone="emerald" dot>
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
          IMAP
        </span>
      </StatusPill>
    );
  }
  if (status === "preview") {
    return <StatusPill tone="amber">OAuth à connecter</StatusPill>;
  }
  return <StatusPill tone="slate">Bientôt</StatusPill>;
}
