/**
 * Allowed / blocked attachment defaults.
 *
 * These are merged with the per-account `MailAttachmentRules` so the user can override
 * any value but never has to start from a blank list.
 */

export const DEFAULT_ALLOWED_EXTENSIONS: string[] = [
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
  "md",
  "eml",
  "csv",
];

export const DEFAULT_BLOCKED_EXTENSIONS: string[] = [
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "ps1",
  "sh",
  "app",
  "dmg",
  "iso",
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "js",
  "vbs",
  "html",
  "htm",
  "xhtml",
  "ics",
];

/**
 * Filenames frequently seen in tracking pixels, email signatures and inline logos.
 * Matched case-insensitively. A simple `includes` is enough — we want to be a bit aggressive.
 */
export const DEFAULT_BLOCKED_NAME_PATTERNS: string[] = [
  "image001",
  "image002",
  "image003",
  "image004",
  "image005",
  "smime.p7s",
  "ATT00",
  "logo",
  "signature",
  "tracking",
  "pixel",
  "spacer",
  "noprint",
  "trans.gif",
  "bandeau",
];

export const DEFAULT_MIN_ATTACHMENT_SIZE_BYTES = 5_000;
export const DEFAULT_MAX_ATTACHMENT_SIZE_BYTES = 30_000_000;
