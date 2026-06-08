import type { MailProvider } from "./types";

export const PROVIDERS: MailProvider[] = [
  {
    id: "gmail",
    name: "Gmail",
    description:
      "Compte Gmail ou Google Workspace. La méthode OAuth2 sécurise l'accès sans stocker votre mot de passe.",
    defaultImapHost: "imap.gmail.com",
    defaultImapPort: 993,
    defaultEncryption: "tls",
    authTypes: ["oauth-gmail", "imap-password"],
    preferredAuthType: "oauth-gmail",
    status: "preview",
    notes: [
      "OAuth Google à connecter (client_id + secret côté serveur).",
      "IMAP : mot de passe d'application requis (validation en 2 étapes).",
    ],
  },
  {
    id: "outlook",
    name: "Outlook / Microsoft 365",
    description:
      "Compte Outlook.com, Hotmail ou Microsoft 365. OAuth2 recommandé pour les comptes pro.",
    defaultImapHost: "outlook.office365.com",
    defaultImapPort: 993,
    defaultEncryption: "tls",
    authTypes: ["oauth-outlook", "imap-password"],
    preferredAuthType: "oauth-outlook",
    status: "preview",
    notes: [
      "OAuth Microsoft à connecter (app registration Azure AD).",
      "IMAP basic peut être désactivé sur certains tenants pro.",
    ],
  },
  {
    id: "custom-imap",
    name: "Autre fournisseur IMAP",
    description: "Tout serveur IMAP standard. Saisissez l'hôte, le port et le chiffrement.",
    defaultImapHost: "",
    defaultImapPort: 993,
    defaultEncryption: "tls",
    authTypes: ["imap-password"],
    preferredAuthType: "imap-password",
    status: "available",
    notes: ["Compatible IMAP/SSL ou IMAP/STARTTLS."],
  },
];

export function findProvider(id: string): MailProvider | null {
  return PROVIDERS.find((provider) => provider.id === id) ?? null;
}
