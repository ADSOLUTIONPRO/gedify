/**
 * Règles déterministes de classification par type de document.
 *
 * Ces règles sont évaluées CÔTÉ SERVEUR après le retour du LLM.
 * Elles permettent de :
 *  1. détecter un type de document depuis les marqueurs OCR ;
 *  2. corriger le type / correspondant / montants si l'IA s'est trompé ;
 *  3. produire des warnings explicites pour l'utilisateur ;
 *  4. bloquer l'auto-apply tant que la correction n'est pas validée.
 */

import type { AnalyzeResult } from "../ai-provider";
import type { AIAnalysisWarning, AIDetectedAmount, AIDetectedDate } from "../types";

export type DocumentKind = "pay_slip" | "tax_notice" | "caf_notice" | "bank_statement" | "invoice" | "other";

export type DocumentTypeRule = {
  id: string;
  description: string;
  markers: RegExp[];
  documentKind: DocumentKind;
  enforceDocumentTypeName?: string;
  enforceTagNames?: string[];
  forbidCorrespondentPatterns?: RegExp[];
  forbidDocumentTypeNames?: RegExp[];
  forbidTagNames?: string[];
  extractEmployer?: {
    nameMarker: RegExp;
    fallbackCanonicalName?: string;
    category?: "employer";
  };
  extractPrimaryAmount?: {
    priorityLabels: string[];
    financialKind: "income" | "expense" | "tax" | "debt" | "other";
    forbidFinancialKinds?: ("income" | "expense" | "tax" | "debt" | "refund" | "invoice" | "subscription" | "due" | "allowance" | "benefit" | "credit" | "loan" | "fees" | "other")[];
  };
  extractPrimaryDate?: {
    priorityLabels: string[];
  };
  weight: "strong" | "medium";
};

export type DocumentTypeWarning = {
  code:
    | "pay_slip_employer_override"
    | "pay_slip_forbidden_correspondent"
    | "pay_slip_forbidden_type"
    | "pay_slip_forbidden_tag"
    | "pay_slip_secondary_organisms"
    | "pay_slip_amount_override"
    | "pay_slip_date_override"
    | "forbidden_correspondent_overridden";
  message: string;
  ruleId: string;
  markers: string[];
};

export type DocumentTypeOutput = {
  correctedAnalysis: AnalyzeResult;
  warnings: DocumentTypeWarning[];
  blockedAutoApplyReason: string | null;
  documentKind: DocumentKind | null;
};

function uniqMarkers(matches: string[]): string[] {
  return Array.from(new Set(matches.map((m) => m.trim()))).filter(Boolean);
}

function runRule(rule: DocumentTypeRule, ocr: string): string[] {
  const found: string[] = [];
  for (const re of rule.markers) {
    const match = ocr.match(re);
    if (match) found.push(match[0]);
    if (found.length >= 8) break;
  }
  return uniqMarkers(found);
}

// ---------------------------------------------------------------------------
// MARQUEURS forts pour un bulletin de salaire / bulletin de paie
// ---------------------------------------------------------------------------

/**
 * Règle principale : bulletin de salaire / bulletin de paie.
 *
 * Critères : présence d'au moins 3 marqueurs forts sur 4 familles (identité,
 * rémunération, cotisations, dates) = qualification certaine.
 *
 * Correspondant = employeur, JAMAIS URSSAF / CAF / CPAM.
 * Montant principal = NET À PAYER (income).
 */
export const DOCUMENT_TYPE_RULES: DocumentTypeRule[] = [
  {
    id: "pay-slip-strong",
    description:
      "Bulletin de salaire / bulletin de paie : correspondant = employeur, URSSAF/CAF/CPAM = organismes secondaires.",
    markers: [
      /BULLETIN\s+DE\s+PAIE/i,
      /BULLETIN\s+DE\s+SALAIRE/i,
      /BULLETIN\s+SALAIRE/i,
      /\bPAYE\b/i,
      /\bEMPLOYEUR\b/i,
      /\bSALARI[É]\b/i,
      /\bSALAIRE\b/i,
      /\bNET\s+(À\s+PAYER|SOCIAL|IMPOSABLE)\b/i,
      /\bBRUT\b/i,
      /\bCOTISATIONS?\b/i,
      /\bCONVENTION\s+COLLECTIVE\b/i,
      /\bDATE\s+DE\s+PAIE\b/i,
      /\bP[É]RIODE\s+DE\s+PAIE\b/i,
      /\bSIRET\b/i,
      /siret\s*\/\s*ape/i,
      /\bCONTRAT\s+DE\s+TRAVAIL\b/i,
    ],
    documentKind: "pay_slip",
    enforceDocumentTypeName: "Bulletin de salaire",
    enforceTagNames: ["salaire", "paie", "bulletin de salaire"],
    // Supprimer les tags fiscaux/CAF qui apparaissent dans les bulletins de paie
    // (prélèvement à la source, cotisations URSSAF, etc. ≠ avis d'imposition)
    forbidTagNames: [
      "Impôts", "impôts", "Fiscalité", "fiscalité",
      "CAF", "caf", "Avis CAF", "avis caf",
      "DGFIP", "dgfip", "Administratif", "administratif",
      "Avis d'imposition", "avis d'imposition",
    ],
    // Interdire les types qui ne correspondent PAS à un bulletin de paie
    forbidDocumentTypeNames: [
      /avis\s+caf/i,
      /courrier\s+caf/i,
      /notification\s+caf/i,
      /courrier\s+urssaf/i,
      /appel\s+de\s+cotisations?\s+urssaf/i,
      /mise\s+en\s+demeure\s+urssaf/i,
      /courrier\s+cpam/i,
      /attestation\s+cpam/i,
      /courrier\s+dgfip/i,
      /avis\s+d[’]imp[oô]t/i,
    ],
    // Interdire ces correspondants comme PRINCIPAL dans un bulletin de paie
    forbidCorrespondentPatterns: [
      /^\s*URSSAF\b/i,
      /urssaf\.fr/i,
      /^\s*CAF\b/i,
      /caisse\s+d[’]?allocations?\s+familiales/i,
      /^\s*CPAM\b/i,
      /assurance\s+maladie/i,
      /\bameli\b/i,
      /p[oô]le\s+emploi/i,
      /\bfrance\s+travail\b/i,
      /centre\s+des\s+finances\s+publiques/i,
      /dgfip/i,
    ],
    extractEmployer: {
      // L'employeur est juste APRÈS ou AVANT le mot EMPLOYEUR
      nameMarker: /(?:\bEMPLOYEUR\b[:\s]*\s*)([A-Z][A-ZÀ-ÿ\s\d]{2,50})/i,
      category: "employer",
    },
    extractPrimaryAmount: {
      // Priorité : NET À PAYER > net versé > net social > net imposable > BRUT
      priorityLabels: [
        "net à payer",
        "net payer",
        "net versé",
        "net social",
        "net imposable",
        "brut",
        "salaire net",
        "total net",
        "montant net",
      ],
      financialKind: "income",
      forbidFinancialKinds: ["expense", "debt", "tax"],
    },
    extractPrimaryDate: {
      // Priorité : période de paie > date de paie > mois de paie
      priorityLabels: [
        "période de paie",
        "date de paie",
        "mois de paie",
        "paye du",
        "payé le",
        "période",
      ],
    },
    weight: "strong",
  },

  {
    id: "tax-notice-strong",
    description: "Avis d'imposition / avis de taxe — correspondant = DGFIP.",
    markers: [
      /\bDGFIP\b/i,
      /direction\s+g[ée]n[ée]rale\s+des\s+finances\s+publiques/i,
      /centre\s+des\s+finances\s+publiques/i,
      /\bavis\s+d[’]imp[oô]t\b/i,
      /\bavis\s+d[’]imposition\b/i,
      /\btaxe\s+fonci[èe]re\b/i,
      /\btaxe\s+d[’]habitation\b/i,
    ],
    documentKind: "tax_notice",
    enforceDocumentTypeName: "Avis d'imposition",
    forbidDocumentTypeNames: [/avis\s+caf/i, /bulletin\s+de\s+paie/i],
    forbidCorrespondentPatterns: [/^\s*CAF\b/i, /^\s*URSSAF\b/i],
    weight: "strong",
  },

  {
    id: "caf-notice-medium",
    description:
      "Document CAF explicite (allocataire, notification, courrier CAF).",
    markers: [
      /(^|\W)CAF(\W|$)/,
      /caisse\s+d[’]?allocations?\s+familiales?/i,
      /\bcaf\.fr\b/i,
      /\ballocations?\s+familiales?\b/i,
      /\bAPL\b/i,
      /\bRSA\b/i,
      /prime\s+d[’]activit[ée]/i,
      /prestation\s+familiale/i,
    ],
    documentKind: "caf_notice",
    enforceDocumentTypeName: "Avis CAF",
    // Un bulletin de paie peut mentionner "CAF" mais N'est PAS un courrier CAF
    forbidDocumentTypeNames: [/bulletin\s+de\s+paie/i],
    weight: "medium",
  },
];

// ---------------------------------------------------------------------------
// Correspondent rules — intégration employeur
// ---------------------------------------------------------------------------

export type EmployerCorrespondentRule = {
  id: string;
  description: string;
  markers: RegExp[];
  category: "employer";
  weight: "strong" | "medium";
};

export const EMPLOYER_CORRESPONDENT_RULES: EmployerCorrespondentRule[] = [
  {
    id: "employer-pay-slip",
    description: "Employeur détecté via bloc EMPLOYEUR d'un bulletin de paie.",
    markers: [
      /\bEMPLOYEUR\b[:\s]*\s*([A-Z][A-ZÀ-ÿ\s\d\,\.'-]{3,60})/i,
      /([A-Z][A-ZÀ-ÿ\s\d\,\.'-]{3,60})\s*\n?[°]?\s*SIRET/i,
      /\bSIRET\b[:\s]*([0-9]{14})/i,
      /\bCode\s+APE\b[:\s]*\s*([A-Z0-9]{4,10})/i,
    ],
    category: "employer",
    weight: "strong",
  },
];

// ---------------------------------------------------------------------------
// Logique de détection de l'employeur dans un bulletin de paie
// ---------------------------------------------------------------------------

export type ExtractedEmployer = {
  name: string;
  siret?: string;
  address?: string;
  category: "employer";
};

/**
 * Extrait l'employeur depuis le texte OCR d'un bulletin de paie.
 *
 * Gère les mises en page à deux colonnes (EMPLOYEUR | SALARIÉ sur la même
 * ligne), les apostrophes droites et courbes, et les variations OCR.
 */
export function extractEmployerFromOCR(
  ocr: string,
  ocrLines?: string[]
): ExtractedEmployer | null {
  const lines = ocrLines ?? ocr.split(/\n/);

  // ── 1. Chercher l'index de la ligne contenant EMPLOYEUR ──────────────────
  let employerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/\bEMPLOYEUR\b/i.test(lines[i])) {
      employerIdx = i;
      break;
    }
  }

  // ── 2. Essayer l'extraction depuis le bloc EMPLOYEUR + lignes suivantes ──
  if (employerIdx >= 0) {
    // Two-column layouts: "EMPLOYEUR           SALARIÉ" → skip that header line.
    // Start from the NEXT line, not the header itself.
    const startIdx = employerIdx + 1;
    const candidateLines = lines.slice(startIdx, startIdx + 6);
    const nameParts: string[] = [];

    for (const line of candidateLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Stop at section headers that signal end of employer block.
      // Allow lines that contain SALARIÉ only if they also look like a name
      // (two-column layout sometimes puts both on the NEXT line, not same line).
      if (
        /^\s*(SALARI[ÉE]|COTISATIONS?|SÉCURITÉ SOCIALE|PÉRIODE DE PAIE|DATE DE PAIE|NET À PAYER|BRUT|SIRET|CODE APE)\s*[:\s]*$/i.test(trimmed)
      ) break;

      // Stop at address lines (starts with digit, >10 chars = postal address)
      if (/^\d{1,5}\s+[A-Za-z]/.test(trimmed)) break;
      if (/^\d{5}\s/.test(trimmed)) break; // Code postal

      // Stop at pure numbers (SIRET found — means we overshot)
      if (/^\d{9,14}$/.test(trimmed)) break;

      // Valid company name line: letters, digits, spaces, punctuation
      // ’ = RIGHT SINGLE QUOTATION MARK (curly apostrophe)
      if (/^[A-Za-zÀ-ÿ\s\d\.,''’&()\-\/]{2,80}$/.test(trimmed)) {
        nameParts.push(trimmed);
        // Only take first meaningful name line for pay slips
        if (nameParts.length >= 2) break;
      }
    }

    if (nameParts.length > 0) {
      const name = nameParts.join(" ").replace(/\s+/g, " ").trim();
      // Search SIRET in nearby lines
      let siret: string | undefined;
      for (let i = startIdx; i < Math.min(startIdx + 12, lines.length); i++) {
        const m = lines[i].match(/\b(\d{14})\b/);
        if (m) { siret = m[1]; break; }
      }
      return { name, siret, category: "employer" };
    }
  }

  // ── 3. Fallback: find company type + name before SIRET ──────────────────
  // Pattern: "SAS / SARL / SA / EURL … [name] … \n … SIRET"
  const companyPattern = /\b(SAS|SARL|SA\b|SCI|EURL|SASU|SNC|GIE|EPIC|EI|SCP|SELAS)\s+([A-ZÀ-ÿ][A-ZÀ-ÿa-zÀ-ÿ\s\d\.,'''’&()-]{2,60})/gi;
  const companyMatches = [...ocr.matchAll(companyPattern)];
  if (companyMatches.length > 0) {
    const best = companyMatches[0];
    const name = `${best[1]} ${best[2]}`.replace(/\s+/g, " ").trim();
    // Search SIRET anywhere
    const siretMatch = ocr.match(/\b(\d{14})\b/);
    return { name, siret: siretMatch?.[1], category: "employer" };
  }

  // ── 4. Fallback: name immediately before SIRET on same or adjacent line ─
  for (let i = 0; i < lines.length; i++) {
    if (/\bSIRET\b/i.test(lines[i]) && i > 0) {
      const prevLine = lines[i - 1].trim();
      // ’ = curly apostrophe
      if (/^[A-ZÀ-ÿ][A-ZÀ-ÿa-zÀ-ÿ\s\d\.,'''’&()-]{3,70}$/.test(prevLine)) {
        const siretMatch = lines[i].match(/\b(\d{14})\b/);
        return { name: prevLine, siret: siretMatch?.[1], category: "employer" };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Logique d'extraction du montant principal dans un bulletin de paie
// ---------------------------------------------------------------------------

export type ExtractedAmount = {
  label: string;
  amount: number;
  financialKind: "income";
};

/**
 * Extrait le montant principal (NET À PAYER) depuis les montants détectés.
 */
export function extractPrimaryAmountFromDetected(
  detectedAmounts: AIDetectedAmount[],
  rule: DocumentTypeRule["extractPrimaryAmount"]
): ExtractedAmount | null {
  if (!rule || detectedAmounts.length === 0) return null;

  for (const labelPattern of rule.priorityLabels) {
    const found = detectedAmounts.find((a) =>
      a.label.toLowerCase().includes(labelPattern.toLowerCase())
    );
    if (found) {
      return {
        label: found.label,
        amount: found.amount,
        financialKind: "income",
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Logique d'extraction de la date principale dans un bulletin de paie
// ---------------------------------------------------------------------------

export type ExtractedDate = {
  label: string;
  date: string;
  iso: string;
};

/**
 * Extrait la date principale (période de paie) depuis les dates détectées.
 */
export function extractPrimaryDateFromDetected(
  detectedDates: AIDetectedDate[],
  rule: DocumentTypeRule["extractPrimaryDate"]
): ExtractedDate | null {
  if (!rule || detectedDates.length === 0) return null;

  for (const labelPattern of rule.priorityLabels) {
    const found = detectedDates.find((d) =>
      d.label.toLowerCase().includes(labelPattern.toLowerCase())
    );
    if (found) {
      return { label: found.label, date: found.date, iso: found.iso };
    }
  }

  // Fallback : dernière date détectée si aucune ne correspond
  const last = detectedDates[detectedDates.length - 1];
  return last ? { label: last.label, date: last.date, iso: last.iso } : null;
}

// ---------------------------------------------------------------------------
// Point d'entrée principal : validation + correction du type document
// ---------------------------------------------------------------------------

export function applyDocumentTypeRules(
  analysis: AnalyzeResult,
  ocrText: string | null | undefined,
  _filename?: string | null
): DocumentTypeOutput {
  const ocr = (ocrText ?? "").normalize("NFC");
  const ocrLines = ocr.split(/\n/);
  const warnings: DocumentTypeWarning[] = [];
  let documentKind: DocumentKind | null = null;

  const corrected: AnalyzeResult = {
    ...analysis,
    suggestedTagNames: [...(analysis.suggestedTagNames ?? [])],
    warnings: [...(analysis.warnings ?? [])],
  };

  let blocked = false;

  // 1. Identifier le type de document
  for (const rule of DOCUMENT_TYPE_RULES) {
    const matched = runRule(rule, ocr);
    if (matched.length === 0) continue;

    documentKind = rule.documentKind;

    // Pour les règles "medium", on n'applique que des warnings, pas de correction
    if (rule.weight === "medium") {
      continue;
    }

    // Règle "strong" : corrections automatiques
    if (rule.enforceDocumentTypeName) {
      corrected.suggestedDocumentTypeName = rule.enforceDocumentTypeName;
      // Fix detectedDocumentKind too — it might differ when the mock provider
      // misclassified (e.g. "avis d'imposition" detected in a pay slip)
      corrected.detectedDocumentKind = rule.enforceDocumentTypeName;
    }

    if (rule.enforceTagNames) {
      // Ajouter les tags obligatoires (pas supprimer ceux de l'utilisateur)
      for (const tag of rule.enforceTagNames) {
        if (!corrected.suggestedTagNames.includes(tag)) {
          corrected.suggestedTagNames.push(tag);
        }
      }
    }

    // Extraction employeur pour les bulletins de salaire
    if (rule.extractEmployer) {
      const employer = extractEmployerFromOCR(ocr, ocrLines);
      if (employer) {
        corrected.suggestedCorrespondentName = employer.name;
        warnings.push({
          code: "pay_slip_employer_override",
          ruleId: rule.id,
          markers: matched,
          message: `Employeur détecté depuis OCR : « ${employer.name} ». URSSAF/CAF/CPAM sont des organismes secondaires dans ce document.`,
        });
      }
    }

    // Extraction montant principal
    if (rule.extractPrimaryAmount && corrected.detectedAmounts?.length) {
      const primary = extractPrimaryAmountFromDetected(
        corrected.detectedAmounts,
        rule.extractPrimaryAmount
      );
      if (primary) {
        // On s'assure que le financialImpact reflète un revenu (income)
        if (corrected.financialImpact?.length) {
          corrected.financialImpact = corrected.financialImpact.map((fi) => ({
            ...fi,
            kind: "income",
            category: "salaire",
            confidence: "medium",
          }));
        }
        warnings.push({
          code: "pay_slip_amount_override",
          ruleId: rule.id,
          markers: matched,
          message: `Montant principal extrait : ${primary.label} = ${primary.amount.toLocaleString("fr-FR")} € (revenu/salaire).`,
        });
      }
    }

    // Extraction date principale
    if (rule.extractPrimaryDate && corrected.detectedDates?.length) {
      const primary = extractPrimaryDateFromDetected(
        corrected.detectedDates,
        rule.extractPrimaryDate
      );
      if (primary) {
        warnings.push({
          code: "pay_slip_date_override",
          ruleId: rule.id,
          markers: matched,
          message: `Date principale extraite : ${primary.label} (${primary.iso}).`,
        });
      }
    }

    // Interdire certains types de documents
    if (rule.forbidDocumentTypeNames && corrected.suggestedDocumentTypeName) {
      for (const re of rule.forbidDocumentTypeNames) {
        if (re.test(corrected.suggestedDocumentTypeName!)) {
          corrected.suggestedDocumentTypeName = rule.enforceDocumentTypeName ?? null;
          warnings.push({
            code: "pay_slip_forbidden_type",
            ruleId: rule.id,
            markers: matched,
            message: `Type « ${analysis.suggestedDocumentTypeName} » interdit pour un bulletin de paie. Corrigé en « ${rule.enforceDocumentTypeName} ».`,
          });
          blocked = true;
        }
      }
    }

    // Interdire certains tags
    if (rule.forbidTagNames) {
      for (const tag of rule.forbidTagNames) {
        if (corrected.suggestedTagNames.includes(tag)) {
          corrected.suggestedTagNames = corrected.suggestedTagNames.filter(
            (t) => t !== tag
          );
          warnings.push({
            code: "pay_slip_forbidden_tag",
            ruleId: rule.id,
            markers: matched,
            message: `Tag « ${tag} » retiré : incompatible avec le type détecté.`,
          });
          blocked = true;
        }
      }
    }

    // Interdire URSSAF / CAF / CPAM comme correspondant principal
    if (rule.forbidCorrespondentPatterns) {
      const proposed = corrected.suggestedCorrespondentName ?? "";
      for (const re of rule.forbidCorrespondentPatterns) {
        if (re.test(proposed)) {
          corrected.suggestedCorrespondentName = null;
          warnings.push({
            code: "pay_slip_forbidden_correspondent",
            ruleId: rule.id,
            markers: matched,
            message: `Correspondant « ${proposed} » interdit comme émetteur principal d'un bulletin de paie. L'employeur doit être identifié manuellement.`,
          });
          blocked = true;
          break;
        }
      }
    }

    // Warning organismes secondaires
    const secondaryOrganisms: string[] = [];
    const orgPatterns = [
      { name: "URSSAF", re: /\bURSSAF\b/i },
      { name: "CAF", re: /(^|\W)CAF(\W|$)/i },
      { name: "CPAM", re: /\bCPAM\b/i },
      { name: "Sécurité sociale", re: /s[ée]curit[ée]\s+sociale/i },
      { name: "Retraite", re: /\bretraite\b/i },
      { name: "Prévoyance", re: /\bpr[ée]voyance\b/i },
      { name: "Mutuelle", re: /\bmutuelle\b/i },
      { name: "Impôts", re: /imp[oô]t|pr[ée]l[èe]vement\s+à?\s+la?\s+source/i },
      { name: "Prévoyance", re: /pr[ée]voyance/i },
    ];
    for (const { name, re } of orgPatterns) {
      if (re.test(ocr) && corrected.suggestedCorrespondentName !== name) {
        secondaryOrganisms.push(name);
      }
    }
    if (secondaryOrganisms.length > 0) {
      warnings.push({
        code: "pay_slip_secondary_organisms",
        ruleId: rule.id,
        markers: matched,
        message: `Organismes détectés comme SECONDaires : ${secondaryOrganisms.join(", ")}. Ils ne sont pas l'émetteur principal.`,
      });
    }
  }

  // 2. Blocage auto-apply si warnings
  if (blocked || warnings.length > 0) {
    corrected.autoApplyEligible = false;
    const policyWarnings: AIAnalysisWarning[] = warnings.map((w) => ({
      code: "policy_violation",
      message: w.message,
    }));
    corrected.warnings = [...(corrected.warnings ?? []), ...policyWarnings];
  }

  return {
    correctedAnalysis: corrected,
    warnings,
    blockedAutoApplyReason: blocked
      ? "Règle de type document (bulletin de paie) : correction appliquée."
      : warnings.length > 0
      ? "Avertissements détectés par les règles de type document."
      : null,
    documentKind,
  };
}