/**
 * Folders and labels that should NEVER be scanned by default.
 *
 * Covers French and English names plus Gmail system labels. Comparison is done
 * case-insensitively against the trailing folder name (after the last "/").
 */

export const DEFAULT_EXCLUDED_FOLDER_NAMES: string[] = [
  // Spam / junk
  "spam",
  "spams",
  "indésirables",
  "indesirables",
  "courrier indésirable",
  "courrier indesirable",
  "junk",
  "junk email",
  // Trash
  "corbeille",
  "trash",
  "deleted items",
  "deleted",
  // Drafts / sent
  "brouillons",
  "drafts",
  "envoyés",
  "envoyes",
  "sent",
  "sent items",
  "outbox",
  // Marketing / categories
  "promotions",
  "publicités",
  "publicites",
  "newsletters",
  "réseaux sociaux",
  "reseaux sociaux",
  "social",
  "forums",
  "notifications",
  "achats",
  "purchases",
];

/**
 * Gmail-specific system labels that should always be excluded.
 * Gmail uses LABELS rather than folders. The Gmail API reports messages by labelIds.
 */
export const GMAIL_EXCLUDED_LABELS: string[] = [
  "SPAM",
  "TRASH",
  "DRAFT",
  "SENT",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_FORUMS",
];

/**
 * Gmail labels which are kept by default. CATEGORY_UPDATES is optional and excluded by default
 * to avoid importing tracking / notification noise.
 */
export const GMAIL_DEFAULT_WATCHED_LABELS: string[] = ["INBOX"];

export function isFolderExcludedByDefault(folder: string): boolean {
  const normalized = lastSegment(folder).toLowerCase().trim();
  return DEFAULT_EXCLUDED_FOLDER_NAMES.includes(normalized);
}

export function isGmailLabelExcludedByDefault(label: string): boolean {
  return GMAIL_EXCLUDED_LABELS.includes(label.toUpperCase());
}

function lastSegment(folder: string): string {
  const parts = folder.split("/");
  return parts[parts.length - 1] ?? folder;
}
