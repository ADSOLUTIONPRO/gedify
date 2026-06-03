import "server-only";

import type { AnalyzeResult } from "../ai-provider";
import type { AIDetectedAmount } from "../types";

// ---------------------------------------------------------------------------
// Tag sets
// ---------------------------------------------------------------------------

const PAY_SLIP_FORBIDDEN_TAGS = new Set([
  // Fiscal / CAF / URSSAF as document type (not allowed for pay slips)
  "Impôts", "impôts", "Fiscalité", "fiscalité",
  "CAF", "caf", "Avis CAF", "avis caf",
  "DGFIP", "dgfip",
  "Avis d'imposition", "avis d'imposition", "Avis d’imposition",
  "Administratif", "administratif",
  "CPAM", "cpam", "Attestation CPAM",
]);

const PAY_SLIP_REQUIRED_TAGS = ["salaire", "paie", "bulletin de salaire"];

// ---------------------------------------------------------------------------
// Summary patterns that are wrong for a pay slip
// ---------------------------------------------------------------------------

const PAY_SLIP_BAD_SUMMARY_PATTERNS = [
  /Ce document est un avis d[''']imposition/i,
  /Ce document semble être un avis d[''']imposition/i,
  /Ce document vient probablement de la CAF/i,
  /Ce document ressemble à une facture/i,
  /Type détecté\s*:\s*Avis d[''']imposition/i,
  /Type détecté\s*:\s*Avis CAF/i,
  /Direction Générale des Finances Publiques/i,
  /Centre des Finances Publiques/i,
  /impôt sur le revenu comme document principal/i,
];

// ---------------------------------------------------------------------------
// Summary builder for pay slips
// ---------------------------------------------------------------------------

function buildPaySlipSummary(analysis: AnalyzeResult): string {
  const parts: string[] = ["Ce document est un bulletin de salaire."];

  if (analysis.suggestedCorrespondentName) {
    parts.push(`L'employeur est ${analysis.suggestedCorrespondentName}.`);
  }

  const netAmount = findNetAmount(analysis.detectedAmounts ?? []);
  if (netAmount) {
    parts.push(
      `Le net à payer est de ${netAmount.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €.`
    );
  }

  if (analysis.detectedDates && analysis.detectedDates.length > 0) {
    const payDate =
      analysis.detectedDates.find((d) =>
        /période|paie|paye/i.test(d.label)
      ) ?? analysis.detectedDates[0];
    parts.push(`Période : ${payDate.date}.`);
  }

  parts.push("Il présente les cotisations sociales, le brut et le net à payer.");

  return parts.join(" ");
}

function buildPaySlipExplanation(analysis: AnalyzeResult): string {
  const netAmount = findNetAmount(analysis.detectedAmounts ?? []);
  const employer = analysis.suggestedCorrespondentName;

  const parts: string[] = [];
  if (employer) {
    parts.push(`Ce bulletin de salaire est émis par ${employer}.`);
  } else {
    parts.push("Ce document est un bulletin de salaire.");
  }
  if (netAmount) {
    parts.push(
      `Votre net à payer est de ${netAmount.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €.`
    );
  }
  parts.push("Vérifiez toutes les informations avant de valider.");
  return parts.join(" ");
}

function findNetAmount(amounts: AIDetectedAmount[]): AIDetectedAmount | null {
  const netPatterns = [
    "net à payer", "net payer", "net versé", "net social",
    "net imposable", "salaire net", "total net", "montant net",
  ];
  for (const pattern of netPatterns) {
    const found = amounts.find((a) => a.label.toLowerCase().includes(pattern));
    if (found) return found;
  }
  return amounts.length > 0 ? amounts[0] : null;
}

// ---------------------------------------------------------------------------
// Main sanitizer
// ---------------------------------------------------------------------------

/**
 * Final pass that removes contradictions between the analysis result and the
 * detected document type. Called after all rule applications.
 *
 * Currently handles:
 *  - pay_slip / Bulletin de salaire: removes fiscal/CAF tags, fixes summary,
 *    ensures correct kind/type, enforces required tags.
 *
 * Safe to call even if no contradictions are present (no-op otherwise).
 */
export function sanitizeFinalAnalysis(analysis: AnalyzeResult): AnalyzeResult {
  const isPaySlip =
    analysis.suggestedDocumentTypeName === "Bulletin de salaire" ||
    analysis.detectedDocumentKind === "Bulletin de salaire" ||
    analysis.detectedDocumentKind === "pay_slip";

  if (!isPaySlip) return analysis;

  const result = { ...analysis };
  const addedWarnings: AnalyzeResult["warnings"] = [];

  // ── 1. Fix detectedDocumentKind ──────────────────────────────────────────
  if (result.detectedDocumentKind !== "Bulletin de salaire") {
    const original = result.detectedDocumentKind;
    result.detectedDocumentKind = "Bulletin de salaire";
    addedWarnings.push({
      code: "policy_violation",
      message: `Type de document corrigé de « ${original} » en « Bulletin de salaire » (règle anti-confusion fiscale).`,
    });
  }

  // ── 2. Fix summary if it mentions the wrong document type ────────────────
  const hasBadSummary = PAY_SLIP_BAD_SUMMARY_PATTERNS.some((p) =>
    p.test(result.summary ?? "")
  );
  if (hasBadSummary) {
    const originalSummary = result.summary;
    result.summary = buildPaySlipSummary(result);
    result.plainLanguageExplanation = buildPaySlipExplanation(result);
    addedWarnings.push({
      code: "policy_violation",
      message: `Résumé corrigé (était : « ${(originalSummary ?? "").slice(0, 80)}… »). Le document est un bulletin de salaire, pas un document fiscal.`,
    });
  }

  // ── 3. Remove forbidden tags ─────────────────────────────────────────────
  const originalTags = result.suggestedTagNames ?? [];
  const cleanedTags = originalTags.filter((t) => !PAY_SLIP_FORBIDDEN_TAGS.has(t));
  if (cleanedTags.length < originalTags.length) {
    const removed = originalTags.filter((t) => PAY_SLIP_FORBIDDEN_TAGS.has(t));
    addedWarnings.push({
      code: "policy_violation",
      message: `Tags supprimés car incompatibles avec un bulletin de salaire : ${removed.join(", ")}.`,
    });
  }

  // ── 4. Ensure required tags ───────────────────────────────────────────────
  const finalTags = [...cleanedTags];
  for (const tag of PAY_SLIP_REQUIRED_TAGS) {
    if (!finalTags.includes(tag)) finalTags.push(tag);
  }
  result.suggestedTagNames = finalTags;

  // ── 5. Merge warnings ─────────────────────────────────────────────────────
  if (addedWarnings.length > 0) {
    result.warnings = [...(result.warnings ?? []), ...addedWarnings];
    result.autoApplyEligible = false;
  }

  return result;
}
