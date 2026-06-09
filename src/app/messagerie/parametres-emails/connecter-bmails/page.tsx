import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { ConnectMailWizard } from "@/components/mail-connector/connect-wizard";
import { GoogleConnectButton } from "@/components/mail-connector/google-connect-button";
import { OutlookConnectButton } from "@/components/mail-connector/outlook-connect-button";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";
import { isGmailStoreSecure } from "@/lib/connectors/gmail/gmail-token-store";
import { getOutlookOAuthConfig } from "@/lib/connectors/outlook/oauth";
import { isOutlookStoreSecure } from "@/lib/connectors/outlook/outlook-token-store";
import { isSecureStorageReady } from "@/lib/mail-connector/encryption";
import { PROVIDERS } from "@/lib/mail-connector/providers";
import type { PageSearchParams } from "@/lib/page-params";
import { firstParam } from "@/lib/page-params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connecter une boîte mail — Messagerie" };

/**
 * Assistant « Connecter une boîte mail » — intégré à l'espace Mails (layout
 * messagerie/layout.tsx → sidebar Mails). Implémentation UNIQUE ; l'ancienne
 * route /emails/connecter redirige ici. Retour vers les paramètres Mails.
 */
export default async function ConnecterBoiteMailPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const initialProvider = firstParam(params, "provider");
  const gmailError = firstParam(params, "gmail_error");
  const outlookError = firstParam(params, "outlook_error");
  const secureStorageReady = isSecureStorageReady();
  const gmailReady = Boolean(getGmailOAuthConfig()) && isGmailStoreSecure();
  const outlookReady = Boolean(getOutlookOAuthConfig()) && isOutlookStoreSecure();
  // Gmail et Outlook se connectent via OAuth (boutons dédiés) → on les retire de
  // l'assistant IMAP « mot de passe » où ils ne fonctionneraient pas.
  const imapProviders = PROVIDERS.filter((p) => p.id !== "gmail" && p.id !== "outlook");

  return (
    <div className="mx-auto w-full max-w-4xl p-4 lg:p-6">
      <PageHeader
        breadcrumb={[{ href: "/dashboard", label: "Accueil" }, { href: "/messagerie/inbox", label: "Mails" }, { href: "/messagerie/parametres-emails", label: "Paramètres des Emails" }, { label: "Connecter une boîte" }]}
        backLink={{ href: "/messagerie/parametres-emails", label: "Paramètres des Emails" }}
        eyebrow="Assistant"
        title="Connecter une boîte mail"
        description="Configurez en quelques étapes une nouvelle boîte mail surveillée par votre GED."
      />

      {gmailError ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" strokeWidth={2} aria-hidden="true" />
          <div className="text-sm text-rose-900">
            <p className="font-bold">Connexion Gmail interrompue</p>
            <p className="mt-1 text-xs">{gmailError}</p>
          </div>
        </div>
      ) : null}

      {outlookError ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" strokeWidth={2} aria-hidden="true" />
          <div className="text-sm text-rose-900">
            <p className="font-bold">Connexion Microsoft interrompue</p>
            <p className="mt-1 text-xs">{outlookError}</p>
          </div>
        </div>
      ) : null}

      <SectionCard
        icon={Mail}
        title="Connexion Google"
        description="Connectez votre compte Gmail ou Google Workspace en quelques clics. Votre mot de passe n'est jamais stocké."
        className="mb-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <GoogleConnectButton
            returnTo="/messagerie/parametres-emails"
            disabledMessage={gmailReady ? undefined : "La connexion Google n'est pas disponible pour le moment. Vous pouvez connecter une boîte IMAP ci-dessous."}
          />
          {gmailReady ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Prêt à connecter
            </span>
          ) : (
            <span className="text-xs text-amber-700">Connexion Google momentanément indisponible — utilisez une boîte IMAP.</span>
          )}
        </div>
        <HelpCard
          tone="blue"
          icon={Mail}
          title="Gmail nécessite une connexion OAuth sécurisée"
          description="Cette méthode permet d'accéder aux pièces jointes Gmail sans stocker votre mot de passe. Le refresh token est chiffré AES-256-GCM côté serveur. Aucun accès en écriture sur votre boîte n'est demandé (scope readonly uniquement)."
          className="mt-4"
        />
      </SectionCard>

      <SectionCard
        icon={Mail}
        title="Connexion Microsoft"
        description="Outlook.com, Hotmail, Live et Microsoft 365. Connexion OAuth2 sécurisée : votre mot de passe n'est jamais stocké."
        className="mb-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <OutlookConnectButton
            returnTo="/messagerie/parametres-emails"
            disabledMessage={outlookReady ? undefined : "La connexion Microsoft n'est pas configurée sur ce serveur (MICROSOFT_CLIENT_ID/SECRET requis)."}
          />
          {outlookReady ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Prêt à connecter
            </span>
          ) : (
            <span className="text-xs text-amber-700">Connexion Microsoft à configurer côté serveur.</span>
          )}
        </div>
        <HelpCard
          tone="blue"
          icon={Mail}
          title="Outlook / Hotmail exige l'authentification moderne (OAuth2)"
          description="Microsoft a désactivé l'authentification par mot de passe (IMAP/SMTP basic) pour les comptes Outlook.com et Hotmail. La connexion se fait via OAuth2 ; le refresh token est chiffré AES-256-GCM côté serveur."
          className="mt-4"
        />
      </SectionCard>

      <SectionCard
        title="Autres fournisseurs (IMAP)"
        description="Yahoo, OVH, o2switch, Infomaniak, Ionos ou tout autre serveur IMAP standard."
        className="mb-6"
      >
        <ConnectMailWizard providers={imapProviders} initialProvider={initialProvider ?? null} secureStorageReady={secureStorageReady} />
      </SectionCard>
    </div>
  );
}
