import type { Metadata } from "next";
import { MailAccountsSettings } from "@/components/messaging/settings/mail-accounts-settings";
import { buildMailAccountVMs } from "@/lib/messaging/mail-account-vm";
import { listSignatures } from "@/lib/messaging/email-signature-store";
import type { SignatureVM } from "@/components/messaging/settings/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paramètres des Emails — Messagerie" };

/**
 * « Emails & boîtes connectées » — implémentation UNIQUE, intégrée à l'espace
 * Mails (layout messagerie/layout.tsx → sidebar Mails). Refonte : une seule
 * liste de boîtes (plus de duplication « Comptes connectés » vs « Comptes
 * Google OAuth »), panneau de détail contextuel par compte (Informations /
 * Synchronisation / Envoi / Signature / Dossiers / Sécurité). Données réelles.
 */
export default async function MessagerieParametresEmailsPage() {
  const [accounts, signatures] = await Promise.all([
    buildMailAccountVMs(),
    listSignatures(),
  ]);
  const signatureVMs: SignatureVM[] = signatures.map((s) => ({ id: s.id, name: s.name, html: s.html, isDefault: s.isDefault, mailbox: s.mailbox }));

  return (
    <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
      <MailAccountsSettings accounts={accounts} signatures={signatureVMs} />
    </div>
  );
}
