import "server-only";

/**
 * Canonical tag names — these are the display names used in Paperless.
 * All tag operations should produce tags from this set when possible.
 */
export const CANONICAL_TAGS: Record<string, string> = {
  // Pay slip
  salaire: "salaire",
  paie: "paie",
  "bulletin de salaire": "bulletin de salaire",
  employeur: "employeur",
  // Invoice
  facture: "Facture",
  paiement: "paiement",
  // Tax
  impots: "impôts",
  "impôts": "impôts",
  fiscalite: "fiscalité",
  "fiscalité": "fiscalité",
  // CAF
  caf: "CAF",
  // CPAM / Health
  cpam: "CPAM",
  sante: "Santé",
  "santé": "Santé",
  mutuelle: "Mutuelle",
  // Bank
  banque: "Banque",
  releve: "Relevé",
  // Legal
  juridique: "Juridique",
  contrat: "Contrat",
  // Documents
  attestation: "Attestation",
  assurance: "Assurance",
  // Admin
  administratif: "Administratif",
  courrier: "Courrier",
  urssaf: "URSSAF",
  // Action
  "à traiter": "À traiter",
  traiter: "À traiter",
  "relance": "relance",
  impaye: "impayé",
  "impayé": "impayé",
};

/**
 * Normalize a single tag to its canonical form.
 * Deduplication-safe: returns the same string for equivalent tags.
 */
export function normalizeTag(tag: string): string {
  if (!tag) return tag;
  const lower = tag.toLowerCase().trim()
    .normalize("NFC")
    .replace(/\s+/g, " ");
  return CANONICAL_TAGS[lower] ?? tag.trim();
}

/**
 * Normalize and deduplicate an array of tags.
 * Preserves original order, removes duplicates after normalization.
 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}

/**
 * Merge tag arrays, normalizing and deduplicating.
 */
export function mergeTags(...tagArrays: string[][]): string[] {
  return normalizeTags(tagArrays.flat());
}

/**
 * Remove tags from a list (case-insensitive after normalization).
 */
export function removeTags(tags: string[], toRemove: string[]): string[] {
  const removeSet = new Set(toRemove.map((t) => normalizeTag(t).toLowerCase()));
  return tags.filter((t) => !removeSet.has(normalizeTag(t).toLowerCase()));
}
