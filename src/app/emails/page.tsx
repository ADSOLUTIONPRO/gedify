import Link from "next/link";
import { AlertTriangle, Inbox, Mail, PenSquare, Plus, ShieldAlert, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { getMailConnectorStatus } from "@/lib/mail-connector/status";
import type { MailAccount } from "@/lib/mail-connector/types";
import { SignaturesManager } from "@/components/messaging/signatures-manager";
import { GmailAccountsManager } from "@/components/messaging/gmail-accounts-manager";
import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";
import { listSignatures } from "@/lib/messaging/email-signature-store";

export const dynamic = "force-dynamic";

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Il y a ${hours} h`;
  return date.toLocaleDateString("fr-FR");
}

export default async function EmailsPage() {
  const [accounts, status, gmailAccounts, signatures] = await Promise.all([
    listAccounts(),
    getMailConnectorStatus(),
    listGmailAccounts(),
    listSignatures(),
  ]);

  return (
    <PageShell>
      <PageHeader
        compact
        backLink={{ href: "/administration", label: "Administration" }}
        breadcrumb={[{ href: "/administration", label: "Administration" }, { label: "Emails" }]}
        title="Emails"
        description="Comptes connectés, OAuth Google et signatures."
        actions={
          <Link href="/emails/connecter" className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Connecter une boîte
          </Link>
        }
      />

      {!status.secureStorageReady ? (
        <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "var(--gedify-orange-soft)", border: "1px solid var(--gedify-orange)" }}>
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-[13px] leading-snug" style={{ color: "var(--text-main)" }}>
            <strong>Stockage sécurisé à connecter.</strong> Définissez <code className="rounded bg-amber-100 px-1 font-mono text-xs text-amber-900">MAIL_CONNECTOR_KEY</code> côté serveur pour chiffrer (AES-256-GCM) les mots de passe IMAP.
          </p>
        </div>
      ) : null}

      {/* Statut compact */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Comptes connectés" value={status.configured} helper={`${status.active} actif(s)`} icon={Inbox} tone="blue" />
        <StatCard label="Dernière synchro" value={status.lastSyncAt ? formatRelative(status.lastSyncAt) : "—"} helper={status.lastSuccessAt ? `Succès : ${formatRelative(status.lastSuccessAt)}` : "Aucune"} icon={Sparkles} tone="violet" />
        <StatCard label="Erreurs (24 h)" value={status.recentErrors} helper={status.recentErrors === 0 ? "Aucune erreur" : "Voir les journaux"} icon={AlertTriangle} tone={status.recentErrors === 0 ? "emerald" : "amber"} />
      </div>

      {/* Comptes connectés (IMAP/SMTP) */}
      <SectionCard title="Comptes connectés" description={`${accounts.length} boîte(s) surveillée(s)`} bodyClassName="p-5">
        {accounts.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: "var(--bg-card-soft)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Aucune boîte connectée</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Connectez une boîte pour démarrer l&apos;import des pièces jointes.</p>
            <Link href="/emails/connecter" className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" /> Connecter une boîte
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => <AccountTile key={account.id} account={account} />)}
            <Link href="/emails/connecter" className="flex items-center gap-3 rounded-xl border bg-white p-4 transition hover:shadow-md" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)" }}>
                <Plus className="h-5 w-5" style={{ color: "var(--accent)" }} strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Connecter une boîte</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Gmail, Outlook, IMAP…</p>
              </div>
            </Link>
          </div>
        )}
      </SectionCard>

      {/* Comptes Google (OAuth) */}
      <SectionCard title={`Comptes Google (OAuth) — ${gmailAccounts.length}`} icon={Mail} description="Connexion Gmail via OAuth (envoi, lecture). Reconnectez si les autorisations changent." bodyClassName="p-5">
        <GmailAccountsManager accounts={gmailAccounts.map((a) => ({ accountId: a.accountId, email: a.email, connectedAt: a.connectedAt }))} />
      </SectionCard>

      {/* Signatures */}
      <SectionCard id="signatures" title="Signatures mail" icon={PenSquare} description="Signatures réutilisables insérées en bas de vos nouveaux mails et réponses." bodyClassName="p-5">
        <SignaturesManager initial={signatures} />
      </SectionCard>
    </PageShell>
  );
}

function AccountTile({ account }: { account: MailAccount }) {
  return (
    <Link href={`/emails/comptes/${account.id}`} className="rounded-xl bg-white p-4 transition hover:shadow-md" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <Mail className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>{account.name || account.email}</p>
            <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{account.email}</p>
          </div>
        </div>
        <StatusPill tone={account.isActive ? "emerald" : "slate"} dot>{account.isActive ? "Actif" : "Pause"}</StatusPill>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span>Provider : <strong style={{ color: "var(--text-main)" }}>{account.provider}</strong></span>
        <span>Auth : <strong style={{ color: "var(--text-main)" }}>{account.authType}</strong></span>
        <span>Sync : <strong style={{ color: "var(--text-main)" }}>{account.syncIntervalMinutes}m</strong></span>
        <span>Dossier : <strong style={{ color: "var(--text-main)" }}>{account.watchedFolder || "INBOX"}</strong></span>
      </div>
    </Link>
  );
}
