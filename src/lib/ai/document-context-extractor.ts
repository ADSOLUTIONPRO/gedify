import "server-only";

/**
 * Extracts the most useful parts of an OCR text for AI analysis.
 *
 * Strategy:
 *  1. Beginning of document (30%) — header, issuer, metadata
 *  2. Keyword-rich lines — amounts, dates, references, identifiers
 *  3. End of document (15%) — totals, signatures, dates
 *
 * Lines within ±1 of a keyword line are included for context.
 * Result is deduplicated and truncated to `maxChars`.
 */

const PRIORITY_KEYWORDS = [
  // Financial
  "net à payer", "net social", "net imposable", "montant ttc", "total ttc",
  "à payer", "solde", "total net", "brut", "cotisations",
  // Identification
  "siret", "siren", "rcs", "ape", "iban", "bic", "n°", "numéro",
  "référence", "dossier", "contrat", "allocataire",
  // Dates
  "période de paie", "date de paie", "échéance", "date limite",
  "date d'émission", "émis le",
  // Organismes clés
  "employeur", "salarié", "employé",
  "urssaf", "cpam", "caf", "dgfip",
  "bulletin de paie", "bulletin de salaire",
  "avis d'imposition", "facture", "mise en demeure",
];

export function buildUsefulOcrContext(ocrText: string, maxChars?: number): string {
  const envChars = Number(process.env.AI_OCR_MAX_CHARS);
  const limit = maxChars ?? (Number.isFinite(envChars) && envChars > 0 ? envChars : 4000);

  if (!ocrText || ocrText.trim().length === 0) return "";
  if (ocrText.length <= limit) return ocrText;

  const lines = ocrText.split("\n");
  const total = lines.length;

  // Section slices (index ranges)
  const beginEnd = Math.floor(total * 0.30);
  const tailStart = Math.floor(total * 0.85);

  const beginningLines = lines.slice(0, beginEnd);
  const tailLines = lines.slice(tailStart);

  // Find keyword-rich lines + neighbours
  const keywordSet = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (PRIORITY_KEYWORDS.some((kw) => lower.includes(kw))) {
      if (i > 0) keywordSet.add(i - 1);
      keywordSet.add(i);
      if (i < lines.length - 1) keywordSet.add(i + 1);
    }
  }
  // Remove indices already in beginning/tail
  for (let i = 0; i < beginEnd; i++) keywordSet.delete(i);
  for (let i = tailStart; i < total; i++) keywordSet.delete(i);

  const keywordLines = [...keywordSet].sort((a, b) => a - b).map((i) => lines[i]);

  const parts = [
    beginningLines.join("\n"),
    keywordLines.length > 0 ? `--- [sections clés] ---\n${keywordLines.join("\n")}` : "",
    tailLines.length > 0 ? `--- [fin] ---\n${tailLines.join("\n")}` : "",
  ].filter(Boolean);

  const result = parts.join("\n");
  if (result.length <= limit) return result;
  return `${result.slice(0, limit)}\n[...tronqué à ${limit} caractères]`;
}
