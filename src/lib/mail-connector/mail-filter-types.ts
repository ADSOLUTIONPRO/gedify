export type MailSenderFilterMode =
  | "allow-all-except-blocked"
  | "allow-listed-only"
  | "allow-known-correspondents-only"
  | "require-matching-rule";

export type MailSenderFilter = {
  mode: MailSenderFilterMode;
  allowedSenders: string[];
  allowedDomains: string[];
  blockedSenders: string[];
  blockedDomains: string[];
  requireKnownCorrespondent: boolean;
  requireMatchingRule: boolean;
};

export const DEFAULT_SENDER_FILTER: MailSenderFilter = {
  mode: "allow-all-except-blocked",
  allowedSenders: [],
  allowedDomains: [],
  blockedSenders: [],
  blockedDomains: [
    "noreply.amazon.fr",
    "marketing@",
    "newsletter@",
  ],
  requireKnownCorrespondent: false,
  requireMatchingRule: false,
};

export type MailAttachmentMode =
  | "pdf-only"
  | "pdf-and-images"
  | "pdf-images-and-office"
  | "all-paperless-compatible"
  | "custom";

export type MailAttachmentRules = {
  mode: MailAttachmentMode;
  allowedExtensions: string[];
  blockedExtensions: string[];
  blockedNamePatterns: string[];
  minSizeBytes: number;
  maxSizeBytes: number;
  skipInline: boolean;
};

export type MailFolderRules = {
  watchedFolders: string[];
  excludedFolders: string[];
  honorDefaultExclusions: boolean;
};

export type MailImportDecision = {
  status: "imported" | "ignored" | "error" | "duplicate" | "pending";
  reason: MailIgnoredReason | null;
  appliedRuleId: string | null;
  appliedRuleName: string | null;
  paperlessTitle?: string;
  paperlessCorrespondentId?: number | null;
  paperlessDocumentTypeId?: number | null;
  paperlessTagIds?: number[];
};

export type MailIgnoredReason =
  | "folder-excluded"
  | "label-excluded"
  | "sender-blocked"
  | "domain-blocked"
  | "sender-not-allowed"
  | "domain-not-allowed"
  | "no-known-correspondent"
  | "no-matching-rule"
  | "extension-blocked"
  | "extension-not-allowed"
  | "name-pattern-blocked"
  | "size-too-small"
  | "size-too-large"
  | "attachment-inline"
  | "already-imported"
  | "rule-ignored"
  | "no-attachment";

export type MailSyncPreviewItem = {
  uid: string;
  folder: string;
  from: string | null;
  subject: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  attachmentMime: string | null;
  decision: MailImportDecision;
};

export type MailSyncPreview = {
  accountId: string;
  scannedFolders: string[];
  skippedFolders: string[];
  wouldImport: MailSyncPreviewItem[];
  wouldIgnore: MailSyncPreviewItem[];
  errors: { folder: string; message: string }[];
  summary: {
    scanned: number;
    importable: number;
    ignored: number;
    duplicates: number;
    errors: number;
  };
};

export type MailContextLite = {
  accountId: string;
  folder: string;
  from: string | null;
  to: string | null;
  subject: string | null;
  attachmentName: string;
  attachmentExtension: string;
  attachmentMime: string;
  attachmentSize: number;
  attachmentInline: boolean;
};
