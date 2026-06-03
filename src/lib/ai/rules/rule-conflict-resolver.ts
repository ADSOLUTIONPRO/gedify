import "server-only";

import type { DocumentKindCode, ClassificationResult } from "./document-classification-engine";

/**
 * Priority order for document kind conflicts.
 * Higher number = higher priority.
 */
export const KIND_PRIORITY: Record<DocumentKindCode, number> = {
  pay_slip: 100,
  invoice: 90,
  demand_letter: 85,
  tax_notice: 80,
  caf_notice: 75,
  cpam_notice: 70,
  urssaf_notice: 65,
  bank_statement: 60,
  insurance: 55,
  mutual: 50,
  contract: 45,
  certificate: 40,
  legal: 35,
  civil: 30,
  admin_letter: 10,
};

/**
 * Correspondant categories forbidden as PRIMARY correspondent for each kind.
 * These entities may appear in documents of that kind but must NOT be the main correspondent.
 */
export const FORBIDDEN_CORRESPONDENT_CATEGORIES: Partial<Record<DocumentKindCode, string[]>> = {
  pay_slip: ["tax_office", "family_allowance", "health_insurance", "urssaf", "employment"],
  invoice: ["tax_office", "family_allowance", "health_insurance"],
  tax_notice: ["family_allowance", "health_insurance", "urssaf", "employer"],
  caf_notice: ["tax_office", "health_insurance", "urssaf", "employer"],
  cpam_notice: ["tax_office", "family_allowance", "urssaf", "employer"],
  urssaf_notice: ["tax_office", "family_allowance", "health_insurance"],
};

/**
 * Tags that are FORBIDDEN for each document kind.
 * Used by the tag normalizer and sanitizer.
 */
export const FORBIDDEN_TAGS_BY_KIND: Partial<Record<DocumentKindCode, string[]>> = {
  pay_slip: [
    "Impôts", "impôts", "Fiscalité", "fiscalité",
    "CAF", "caf", "Avis CAF", "avis caf",
    "DGFIP", "dgfip",
    "Avis d'imposition", "avis d'imposition",
    "Administratif",
  ],
  tax_notice: ["CAF", "caf", "bulletin de salaire", "salaire", "paie"],
  caf_notice: ["impôts", "Impôts", "bulletin de salaire", "salaire"],
  invoice: ["bulletin de salaire", "salaire", "paie", "CAF"],
};

/**
 * Required tags for each document kind — always present in the final result.
 */
export const REQUIRED_TAGS_BY_KIND: Partial<Record<DocumentKindCode, string[]>> = {
  pay_slip: ["salaire", "paie", "bulletin de salaire"],
  invoice: ["Facture"],
  tax_notice: ["impôts"],
  caf_notice: ["CAF"],
  cpam_notice: ["Santé"],
  urssaf_notice: ["URSSAF"],
  bank_statement: ["Banque"],
  insurance: ["Assurance"],
  mutual: ["Santé", "Mutuelle"],
  contract: ["Contrat"],
  certificate: ["Attestation"],
  legal: ["Juridique"],
};

/**
 * Resolve conflicts between multiple ClassificationResults and return
 * the definitive winner based on priority rules.
 */
export function resolveBestClassification(
  candidates: ClassificationResult[]
): ClassificationResult | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, current) =>
    (KIND_PRIORITY[current.kind] ?? 0) > (KIND_PRIORITY[best.kind] ?? 0) ? current : best
  );
}

/**
 * Check if a correspondent category is forbidden for the given document kind.
 */
export function isCorrespondentForbidden(
  kind: DocumentKindCode,
  correspondentCategory: string
): boolean {
  return FORBIDDEN_CORRESPONDENT_CATEGORIES[kind]?.includes(correspondentCategory) ?? false;
}

/**
 * Get the tags to add and remove for a given document kind.
 * Returns { add, remove } sets.
 */
export function getTagDiff(
  kind: DocumentKindCode,
  currentTags: string[]
): { add: string[]; remove: string[] } {
  const forbidden = new Set(FORBIDDEN_TAGS_BY_KIND[kind] ?? []);
  const required = REQUIRED_TAGS_BY_KIND[kind] ?? [];

  return {
    add: required.filter((t) => !currentTags.includes(t)),
    remove: currentTags.filter((t) => forbidden.has(t)),
  };
}
