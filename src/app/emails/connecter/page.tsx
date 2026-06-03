import { AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { ConnectMailWizard } from "@/components/mail-connector/connect-wizard";
import { GoogleConnectButton } from "@/components/mail-connector/google-connect-button";
import { HelpCard } from "@/components/ui/help-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";
import { isGmailStoreSecure } from "@/lib/connectors/gmail/gmail-token-store";
import { isSecureStorageReady } from "@/lib/mail-connector/encryption";
import { PROVIDERS } from "@/lib/mail-connector/providers";
import type { PageSearchParams } from "@/lib/page-params";
import { firstParam } from "@/lib/page-params";

export const dynamic = "force-dynamic";

export default async function ConnectMailPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const initialProvider = firstParam(params, "provider");
  const gmailError = firstParam(params, "gmail_error");
  const secureStorageReady = isSecureStorageReady();
  const gmailConfig = getGmailOAuthConfig();
  const gmailReady = Boolean(gmailConfig) && isGmailStoreSecure();

  return (
    <main className="p-4 lg:p-8">
      <PageHeader
        backLink={{ href: "/emails", label: "Emails" }}
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

      <SectionCard
        icon={Mail}
        title="Méthode rapide : OAuth Google"
        description="Connectez votre compte Gmail en quelques clics. Cette méthode ne stocke pas votre mot de passe."
        className="mb-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <GoogleConnectButton
            disabledMessage={
              gmailReady
                ? undefined
                : !gmailConfig
                  ? "OAuth Google à connecter : définissez GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI côté serveur."
                  : "Stockage sécurisé à connecter : définissez CONNECTOR_SECRET_KEY (16+ caractères)."
            }
          />
          {gmailReady ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              OAuth Google prêt — scope demandé : <code className="rounded bg-emerald-100 px-1 font-mono">gmail.readonly</code>
            </span>
          ) : (
            <span className="text-xs text-amber-700">
              {!gmailConfig
                ? "OAuth Google à connecter (variables d'environnement manquantes)."
                : "Définissez CONNECTOR_SECRET_KEY pour chiffrer le refresh_token."}
            </span>
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
        title="Autres fournisseurs (IMAP)"
        description="Yahoo, OVH, o2switch, Infomaniak, Ionos ou tout autre serveur IMAP standard."
        className="mb-6"
      >
        <ConnectMailWizard
          providers={PROVIDERS}
          initialProvider={initialProvider ?? null}
          secureStorageReady={secureStorageReady}
        />
      </SectionCard>
    </main>
  );
}
