import "server-only";

import {
  DEFAULT_BLOCKED_EXTENSIONS,
  DEFAULT_BLOCKED_NAME_PATTERNS,
  DEFAULT_MAX_ATTACHMENT_SIZE_BYTES,
  DEFAULT_MIN_ATTACHMENT_SIZE_BYTES,
  DEFAULT_ALLOWED_EXTENSIONS,
} from "./default-attachment-rules";
import {
  DEFAULT_EXCLUDED_FOLDER_NAMES,
  GMAIL_EXCLUDED_LABELS,
  isFolderExcludedByDefault,
  isGmailLabelExcludedByDefault,
} from "./default-excluded-folders";
import type {
  MailAttachmentMode,
  MailAttachmentRules,
  MailContextLite,
  MailFolderRules,
  MailIgnoredReason,
  MailSenderFilter,
} from "./mail-filter-types";

// ---------------------------------------------------------------------------
// Folder / label
// ---------------------------------------------------------------------------

export type FolderDecision = { allow: boolean; reason: MailIgnoredReason | null };

export function evaluateFolder(
  folder: string,
  rules: MailFolderRules | null | undefined,
): FolderDecision {
  const normalized = folder.toLowerCase().trim();

  if (rules?.excludedFolders.some((entry) => entry.toLowerCase().trim() === normalized)) {
    return { allow: false, reason: "folder-excluded" };
  }

  if (rules?.honorDefaultExclusions !== false && isFolderExcludedByDefault(folder)) {
    return { allow: false, reason: "folder-excluded" };
  }

  if (rules?.watchedFolders.length) {
    const allowed = rules.watchedFolders.some(
      (entry) => entry.toLowerCase().trim() === normalized,
    );
    if (!allowed) {
      return { allow: false, reason: "folder-excluded" };
    }
  }

  return { allow: true, reason: null };
}

export function evaluateGmailLabels(
  labelIds: string[],
  rules: MailFolderRules | null | undefined,
): FolderDecision {
  if (labelIds.some((id) => isGmailLabelExcludedByDefault(id))) {
    if (rules?.honorDefaultExclusions !== false) {
      return { allow: false, reason: "label-excluded" };
    }
  }
  if (rules?.excludedFolders.some((entry) => labelIds.includes(entry))) {
    return { allow: false, reason: "label-excluded" };
  }
  if (rules?.watchedFolders.length) {
    const allowed = rules.watchedFolders.some((entry) => labelIds.includes(entry));
    if (!allowed) {
      return { allow: false, reason: "label-excluded" };
    }
  }
  return { allow: true, reason: null };
}

// ---------------------------------------------------------------------------
// Sender
// ---------------------------------------------------------------------------

export type SenderDecision = { allow: boolean; reason: MailIgnoredReason | null };

function extractEmail(from: string | null): string | null {
  if (!from) return null;
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}

function extractDomain(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : null;
}

function matchesAny(value: string, list: string[]): boolean {
  if (!list || list.length === 0) return false;
  return list.some((entry) => {
    const needle = entry.toLowerCase().trim();
    if (!needle) return false;
    return value.includes(needle);
  });
}

export function evaluateSender(
  from: string | null,
  filter: MailSenderFilter | null | undefined,
  options: { knownCorrespondents?: string[]; ruleMatched?: boolean } = {},
): SenderDecision {
  if (!filter) return { allow: true, reason: null };

  const email = extractEmail(from) ?? "";
  const domain = extractDomain(email) ?? "";

  if (email && (matchesAny(email, filter.blockedSenders) || matchesAny(domain, filter.blockedDomains))) {
    return { allow: false, reason: matchesAny(email, filter.blockedSenders) ? "sender-blocked" : "domain-blocked" };
  }

  switch (filter.mode) {
    case "allow-all-except-blocked":
      return { allow: true, reason: null };
    case "allow-listed-only": {
      const allowed =
        matchesAny(email, filter.allowedSenders) || matchesAny(domain, filter.allowedDomains);
      return allowed
        ? { allow: true, reason: null }
        : { allow: false, reason: "sender-not-allowed" };
    }
    case "allow-known-correspondents-only": {
      const known = options.knownCorrespondents ?? [];
      const matched = known.some((name) =>
        matchesAny(name.toLowerCase(), [email, domain].filter(Boolean)),
      );
      if (!matched) return { allow: false, reason: "no-known-correspondent" };
      return { allow: true, reason: null };
    }
    case "require-matching-rule": {
      if (!options.ruleMatched) return { allow: false, reason: "no-matching-rule" };
      return { allow: true, reason: null };
    }
    default:
      return { allow: true, reason: null };
  }
}

// ---------------------------------------------------------------------------
// Attachment
// ---------------------------------------------------------------------------

export type AttachmentDecision = { allow: boolean; reason: MailIgnoredReason | null };

function modeAllowsExtension(mode: MailAttachmentMode, ext: string): boolean {
  switch (mode) {
    case "pdf-only":
      return ext === "pdf";
    case "pdf-and-images":
      return ["pdf", "jpg", "jpeg", "png", "tiff", "tif", "heic", "webp"].includes(ext);
    case "pdf-images-and-office":
      return [
        "pdf",
        "jpg",
        "jpeg",
        "png",
        "tiff",
        "tif",
        "heic",
        "webp",
        "docx",
        "doc",
        "xlsx",
        "xls",
        "odt",
        "ods",
        "txt",
      ].includes(ext);
    case "all-paperless-compatible":
      return DEFAULT_ALLOWED_EXTENSIONS.includes(ext);
    case "custom":
      return true;
    default:
      return false;
  }
}

export function evaluateAttachment(
  context: MailContextLite,
  rules: MailAttachmentRules | null | undefined,
): AttachmentDecision {
  const effective: MailAttachmentRules = rules ?? {
    mode: "pdf-only",
    allowedExtensions: DEFAULT_ALLOWED_EXTENSIONS,
    blockedExtensions: DEFAULT_BLOCKED_EXTENSIONS,
    blockedNamePatterns: DEFAULT_BLOCKED_NAME_PATTERNS,
    minSizeBytes: DEFAULT_MIN_ATTACHMENT_SIZE_BYTES,
    maxSizeBytes: DEFAULT_MAX_ATTACHMENT_SIZE_BYTES,
    skipInline: true,
  };

  if (effective.skipInline && context.attachmentInline) {
    return { allow: false, reason: "attachment-inline" };
  }

  const ext = context.attachmentExtension.toLowerCase();
  if (effective.blockedExtensions.includes(ext)) {
    return { allow: false, reason: "extension-blocked" };
  }

  if (!modeAllowsExtension(effective.mode, ext)) {
    return { allow: false, reason: "extension-not-allowed" };
  }
  if (effective.mode === "custom") {
    if (!effective.allowedExtensions.includes(ext)) {
      return { allow: false, reason: "extension-not-allowed" };
    }
  }

  const name = context.attachmentName.toLowerCase();
  if (effective.blockedNamePatterns.some((pattern) => name.includes(pattern.toLowerCase()))) {
    return { allow: false, reason: "name-pattern-blocked" };
  }

  if (context.attachmentSize > 0 && context.attachmentSize < effective.minSizeBytes) {
    return { allow: false, reason: "size-too-small" };
  }
  if (context.attachmentSize > effective.maxSizeBytes) {
    return { allow: false, reason: "size-too-large" };
  }

  return { allow: true, reason: null };
}

// ---------------------------------------------------------------------------
// Helpers exposed for UI / debug
// ---------------------------------------------------------------------------

export {
  DEFAULT_BLOCKED_EXTENSIONS,
  DEFAULT_BLOCKED_NAME_PATTERNS,
  DEFAULT_EXCLUDED_FOLDER_NAMES,
  DEFAULT_MAX_ATTACHMENT_SIZE_BYTES,
  DEFAULT_MIN_ATTACHMENT_SIZE_BYTES,
  GMAIL_EXCLUDED_LABELS,
};
