import type {
  MailAttachmentRules,
  MailFolderRules,
  MailSenderFilter,
} from "./mail-filter-types";

export type MailEncryption = "tls" | "starttls" | "none";

export type MailAuthType = "imap-password" | "oauth-gmail" | "oauth-outlook";

export type MailProviderId =
  | "gmail"
  | "outlook"
  | "yahoo"
  | "ovh"
  | "o2switch"
  | "infomaniak"
  | "ionos"
  | "custom-imap";

export type MailProviderStatus = "available" | "preview" | "coming-soon";

export type MailAttachmentFilter = "pdf-only" | "all-compatible";

export type MailProvider = {
  id: MailProviderId;
  name: string;
  description: string;
  defaultImapHost: string | null;
  defaultImapPort: number;
  defaultEncryption: MailEncryption;
  authTypes: MailAuthType[];
  preferredAuthType: MailAuthType;
  status: MailProviderStatus;
  notes: string[];
};

export type MailAccount = {
  id: string;
  name: string;
  email: string;
  provider: MailProviderId;
  authType: MailAuthType;
  imapHost: string;
  imapPort: number;
  encryption: MailEncryption;
  username: string;
  /** SMTP (envoi). null pour les comptes legacy / OAuth. Le mot de passe SMTP
   *  réutilise par défaut le mot de passe IMAP (cas courant des fournisseurs). */
  smtpHost: string | null;
  smtpPort: number | null;
  smtpEncryption: MailEncryption | null;
  smtpUsername: string | null;
  /** Ciphertext (AES-256-GCM) encoded as `iv:tag:ciphertext` in base64. Never returned by the API. */
  encryptedPassword: string | null;
  hasPassword: boolean;
  watchedFolder: string;
  isActive: boolean;
  syncIntervalMinutes: number;
  markAsRead: boolean;
  ignoreAlreadyRead: boolean;
  deleteAfterImport: boolean;
  attachmentFilter: MailAttachmentFilter;
  defaultTags: number[];
  defaultCorrespondent: number | null;
  defaultDocumentType: number | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  /** Detailed filter rules; nullable for legacy accounts created before these were added. */
  folderRules: MailFolderRules | null;
  senderFilter: MailSenderFilter | null;
  attachmentRules: MailAttachmentRules | null;
  /** Connector adapter type. Empty/null for legacy IMAP-only accounts. */
  connector: "imap" | "gmail-oauth" | null;
  /** Persisted account email reported by Gmail (refresh token holder) — gmail-oauth only. */
  gmailEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MailAccountInput = Partial<
  Omit<MailAccount, "id" | "encryptedPassword" | "hasPassword" | "createdAt" | "updatedAt" | "lastSyncAt" | "lastSuccessAt" | "lastError">
> & {
  /** Plaintext password only used during create/update; never persisted in clear. */
  password?: string | null;
};

export type MailRuleConditionField =
  | "sender-contains"
  | "subject-contains"
  | "recipient-contains"
  | "attachment-name-contains"
  | "attachment-extension"
  | "folder"
  | "account";

export type MailRuleCondition = {
  field: MailRuleConditionField;
  value: string;
};

export type MailRuleActionField =
  | "apply-tag"
  | "set-document-type"
  | "set-correspondent"
  | "rename-document"
  | "add-note"
  | "mark-to-process"
  | "ignore";

export type MailRuleAction = {
  field: MailRuleActionField;
  /** For ID-based fields (tag, document_type, correspondent), this is the Paperless ID as string. For text actions, this is text. */
  value: string;
};

export type MailRule = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  accountIds: string[];
  conditions: MailRuleCondition[];
  actions: MailRuleAction[];
  createdAt: string;
  updatedAt: string;
};

export type MailRuleInput = Partial<Omit<MailRule, "id" | "createdAt" | "updatedAt">>;

export type MailSyncLogStatus = "imported" | "ignored" | "error" | "duplicate" | "pending";

export type MailSyncLog = {
  id: string;
  accountId: string;
  accountName: string;
  emailUid: string | null;
  messageId: string | null;
  from: string | null;
  subject: string | null;
  attachmentName: string | null;
  status: MailSyncLogStatus;
  paperlessDocumentId: number | null;
  appliedRuleId: string | null;
  errorMessage: string | null;
  durationMs: number;
  createdAt: string;
};

export type MailSyncLogInput = Omit<MailSyncLog, "id" | "createdAt">;

export type MailConnectorStatus = {
  configured: number;
  active: number;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  recentErrors: number;
  secureStorageReady: boolean;
  oauthGmailReady: boolean;
  oauthOutlookReady: boolean;
  workerReady: boolean;
  storageDriver: "json-file" | "postgres" | "supabase" | "unknown";
};

export type MailTestResult = {
  ok: boolean;
  code:
    | "success"
    | "auth-failed"
    | "host-unreachable"
    | "tls-failed"
    | "folder-not-found"
    | "missing-password"
    | "imap-not-implemented"
    | "unknown";
  message: string;
  folders?: string[];
  durationMs: number;
};

export type MailSyncResult = {
  accountId: string;
  ok: boolean;
  imported: number;
  ignored: number;
  errors: number;
  duplicates: number;
  durationMs: number;
  message: string;
  logIds: string[];
};
