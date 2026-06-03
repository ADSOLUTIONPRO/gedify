import { PenSquare, ShieldCheck } from "lucide-react";
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
            title={`Comptes Gmail connectés (${accounts.length})`}
            description="Reconnectez (mise à jour sans doublon), supprimez ou ajoutez des comptes."
          >
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
              <li>Tokens chiffrés AES-256-GCM côté serveur.</li>
              <li>Aucune clé Google côté client.</li>
              <li>Phase 1 : scope `gmail.readonly` uniquement.</li>
              <li>Phase 3 : scopes `compose` / `send` à activer explicitement.</li>
            </ul>
          </RightRailCard>
        </aside>
      </div>
    </PageShell>
  );
}
