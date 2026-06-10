/**
 * Types unifiés pour la couche Messagerie (Gmail + Phase 1).
 *
 * Le but est d'abstraire la représentation Gmail pour permettre l'ajout
 * de connecteurs (IMAP/Outlook) plus tard sans changer l'UI.
 */

export type EmailAddress = {
  /** Adresse e-mail normalisée (lowercase, trimmed). */
  email: string;
  /** Nom d'affichage extrait du header `From:` / `To:` quand disponible. */
  name: string | null;
};

export type EmailAttachmentRef = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  /** Pièce jointe inline (logo, signature) — à exclure par défaut de l'import. */
  inline: boolean;
};

export type EmailMessageRecord = {
  /** Identifiant Gmail (immutable). */
  id: string;
  /** Identifiant du fil de discussion auquel le message appartient. */
  threadId: string;
  /** Compte Gmail OAuth associé. */
  accountId: string;
  accountEmail: string;
  /** Date du message (`Date:` header, ISO). */
  date: string | null;
  /** Snippet Gmail (texte d'aperçu). */
  snippet: string | null;
  subject: string | null;
  from: EmailAddress | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  /** Labels Gmail (`INBOX`, `IMPORTANT`, `UNREAD`, …). */
  labelIds: string[];
  attachments: EmailAttachmentRef[];
  /** Vrai si non lu (présence de label UNREAD). */
  unread: boolean;
  /** Vrai si label IMPORTANT/STARRED. */
  important: boolean;
  /** Corps texte brut (extrait depuis text/plain en premier, sinon dépouillé du HTML). */
  bodyText: string;
  /** Corps HTML (`text/html`) si disponible. */
  bodyHtml: string | null;
};

export type EmailThreadRecord = {
  id: string;
  accountId: string;
  accountEmail: string;
  /** Fournisseur (défaut : gmail). "imap" = élément lecture seule dans l'inbox unifiée. */
  provider?: "gmail" | "imap";
  subject: string | null;
  snippet: string | null;
  /** Date du message le plus récent dans le thread (ISO). */
  lastMessageAt: string | null;
  participants: EmailAddress[];
  messageCount: number;
  attachmentCount: number;
  unread: boolean;
  important: boolean;
  labelIds: string[];
  hasAttachments: boolean;
};

/**
 * Catégories métier détectées par l'IA (alignées sur la spec utilisateur).
 */
export type EmailCategory =
  | "administratif"
  | "facture"
  | "relance"
  | "personnel"
  | "professionnel"
  | "rendez-vous"
  | "juridique"
  | "sante"
  | "banque"
  | "assurance"
  | "spam"
  | "autre";

export type EmailImportance = "low" | "normal" | "high" | "urgent";

/**
 * Analyse IA persistée pour un message.
 *
 * NB : la même structure est partagée par les threads (en aggregant
 * l'analyse du message le plus pertinent du thread).
 */
export type EmailAnalysis = {
  messageId: string;
  threadId: string;
  summary: string;
  category: EmailCategory;
  importance: EmailImportance;
  suggestedCorrespondentName: string | null;
  suggestedProjectName: string | null;
  suggestedAction: string | null;
  detectedMeeting: {
    date: string | null;
    location: string | null;
  } | null;
  detectedBudget: {
    amount: number | null;
    currency: string | null;
    kind: string | null;
  } | null;
  suggestedReply: string | null;
  confidence: "low" | "medium" | "high";
  createdAt: string;
};

/**
 * Liaison entre un email (ou thread) et une entité GED.
 * Plusieurs liens par email sont autorisés.
 */
export type EmailGedLinkTarget =
  | { kind: "document"; documentId: number }
  | { kind: "correspondent"; correspondentId: number; correspondentName: string }
  | { kind: "project"; projectId: string; projectName: string }
  | { kind: "action"; actionId: string }
  | { kind: "calendar"; eventId: string }
  | { kind: "financial_item"; financialItemId: string };

export type EmailGedLink = {
  id: string;
  /** Message Gmail (ou thread si scope=thread). */
  emailId: string;
  scope: "message" | "thread";
  accountId: string;
  target: EmailGedLinkTarget;
  /** Origine de la liaison (utilisateur, IA, règle…). */
  source: "user" | "ai" | "rule" | "import";
  createdAt: string;
};

/**
 * Contact unifié provenant du connecteur Google (My Contacts ou
 * Other Contacts). Les contacts importés sont matchés au correspondant GED
 * via `EmailContactLink`.
 */
export type EmailContactRecord = {
  /** `people/cXXXXX` ou identifiant interne fabriqué. */
  resourceName: string;
  accountId: string;
  accountEmail: string;
  displayName: string;
  email: string | null;
  emails: string[];
  phone: string | null;
  organization: string | null;
  /** Adresse postale libre (saisie/édition manuelle) — optionnel, rétrocompatible. */
  address?: string | null;
  /** Notes libres (saisie/édition manuelle) — optionnel, rétrocompatible. */
  notes?: string | null;
  /** Origine : Google People (`people`/`other_contacts`), détecté dans les
   *  emails (`imap_email`), ou saisi manuellement (`manual`). */
  source: "people" | "other_contacts" | "imap_email" | "manual";
  /** ID du correspondant Paperless lié (si déjà associé). */
  correspondentId: number | null;
  /** Si `correspondentId === null` : suggestion automatique du matcher. */
  suggestedCorrespondentId: number | null;
  suggestedScore: number | null;
  /** Mémoire de matching. */
  status: "linked" | "suggested" | "ignored" | "new" | "manual";
  /** Vrai si l'utilisateur a édité manuellement la fiche : ses champs (nom,
   *  téléphone, société, adresse, notes, emails) sont alors PRÉSERVÉS lors des
   *  prochaines synchronisations (Google/IMAP ne les écrasent plus). */
  manuallyEdited?: boolean;
  updatedAt: string;
};

/**
 * Enregistre une PJ importée dans la GED depuis un email.
 */
export type EmailAttachmentImport = {
  emailId: string;
  threadId: string;
  accountId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  paperlessDocumentId: number | null;
  importedAt: string;
  ignoredReason?: string;
};
