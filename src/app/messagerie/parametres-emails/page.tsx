import type { Metadata } from "next";
import { MailAccountsSettings, type InitialConnect } from "@/components/messaging/settings/mail-accounts-settings";
import { buildMailAccountVMs } from "@/lib/messaging/mail-account-vm";
import { listSignatures } from "@/lib/messaging/email-signature-store";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";
import { getOutlookOAuthConfig } from "@/lib/connectors/outlook/oauth";
import type { SignatureVM } from "@/components/messaging/settings/types";
import type { PageSearchParams } from "@/lib/page-params";
import { firstParam } from "@/lib/page-params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paramètres des Emails — Messagerie" };

/** Construit l'état de reprise de la modale à partir de l'URL : retour OAuth
 *  (gmail|outlook=connected&accountId), erreur OAuth, ou ouverture directe
 *  (?modal=connect-mailbox, ?provider=icloud depuis l'ancienne route). */
function readInitialConnect(params: Record<string, string | string[] | undefined>): InitialConnect | undefined {
  const accountId = firstParam(params, "accountId") ?? undefined;
  if (firstParam(params, "gmail") === "connected") return { oauthProvider: "google", accountId };
  if (firstParam(params, "outlook") === "connected") return { oauthProvider: "microsoft", accountId };
  const error = firstParam(params, "gmail_error") ?? firstParam(params, "outlook_error");
  if (error) return { error };
  if (firstParam(params, "modal") === "connect-mailbox") {
    const provider = firstParam(params, "provider");
    if (provider === "icloud" || provider === "apple") return { provider: "apple" };
    if (provider && provider !== "gmail" && provider !== "outlook") return { provider: "custom" };
    return { open: true };
  }
  return undefined;
}

/**
 * « Emails & boîtes connectées » — implémentation UNIQUE, intégrée à l'espace
 * Mails (layout messagerie/layout.tsx → sidebar Mails). Refonte : une seule
 * liste de boîtes (plus de duplication « Comptes connectés » vs « Comptes
 * Google OAuth »), panneau de détail contextuel par compte (Informations /
 * Synchronisation / Envoi / Signature / Dossiers / Sécurité). Données réelles.
 */
export default async function MessagerieParametresEmailsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const initialConnect = readInitialConnect(params);
  const [accounts, signatures] = await Promise.all([
    buildMailAccountVMs(),
    listSignatures(),
  ]);
  const signatureVMs: SignatureVM[] = signatures.map((s) => ({ id: s.id, name: s.name, html: s.html, isDefault: s.isDefault, mailbox: s.mailbox }));
  // OAuth configuré côté serveur ? → la modale affiche/masque les options OAuth.
  const googleOAuthAvailable = getGmailOAuthConfig() != null;
  const microsoftOAuthAvailable = getOutlookOAuthConfig() != null;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
      <MailAccountsSettings
        accounts={accounts}
        signatures={signatureVMs}
        initialConnect={initialConnect}
        googleOAuthAvailable={googleOAuthAvailable}
        microsoftOAuthAvailable={microsoftOAuthAvailable}
      />
    </div>
  );
}
