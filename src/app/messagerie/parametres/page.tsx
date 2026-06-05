import Link from "next/link";
import { PenSquare, ShieldCheck, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { SignaturesManager } from "@/components/messaging/signatures-manager";
import { GmailAccountsManager } from "@/components/messaging/gmail-accounts-manager";
import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";
import { listSignatures } from "@/lib/messaging/email-signature-store";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";

export const dynamic = "force-dynamic";

export default async function MessagerieParametresPage() {
  const config = getGmailOAuthConfig();
  const [accounts, signatures] = await Promise.all([listGmailAccounts(), listSignatures()]);

  return (
    <PageShell>
      <PageHeader
        breadcrumb={[
          { href: "/dashboard", label: "Accueil" },
          { href: "/messagerie", label: "Messagerie" },
          { label: "Paramètres" },
        ]}
        backLink={{ href: "/messagerie", label: "Retour à la boîte" }}
        title="Paramètres messagerie"
        description="Connexions Gmail, scopes OAuth et hygiène des secrets."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <SectionCard title="OAuth Google" icon={ShieldCheck}>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Statut</span>
                <StatusPill tone={config ? "emerald" : "amber"} dot>
                  {config ? "Configuré" : "À configurer"}
                </StatusPill>
              </li>
              <li className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Redirect URI</span>
                <span
                  className="font-mono text-[11px]"
                  style={{ color: "var(--text-main)" }}
                >
                  {config?.redirectUri ?? "—"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Scopes Gmail</span>
                <span
                  className="text-right text-[11px]"
                  style={{ color: "var(--text-main)" }}
                >
                  {config?.scopes.length ?? 0} scope(s)
                </span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title={`Comptes mail connectés (${accounts.length})`}
            description="Ajoutez un compte Google (OAuth) ou IMAP (détection automatique), reconnectez ou supprimez."
          >
            <Link
              href="/emails/connecter"
              className="mb-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--blue-600)" }}
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Ajouter une boîte mails
            </Link>
            <GmailAccountsManager
              accounts={accounts.map((a) => ({ accountId: a.accountId, email: a.email, connectedAt: a.connectedAt }))}
            />
          </SectionCard>

          <SectionCard
            title="Signatures mail"
            icon={PenSquare}
            description="Créez des signatures réutilisables, insérées en bas de vos nouveaux mails et réponses."
          >
            <SignaturesManager initial={signatures} />
          </SectionCard>
        </div>

        <aside className="space-y-5">
          <RightRailCard title="Sécurité" icon={ShieldCheck} iconTone="emerald">
            <ul className="space-y-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <li>Identifiants chiffrés côté serveur.</li>
              <li>Aucun mot de passe stocké en clair.</li>
              <li>Vos données mail restent privées.</li>
            </ul>
          </RightRailCard>
        </aside>
      </div>
    </PageShell>
  );
}
