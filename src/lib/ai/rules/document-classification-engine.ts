import "server-only";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentKindCode =
  | "pay_slip"
  | "invoice"
  | "demand_letter"
  | "tax_notice"
  | "caf_notice"
  | "cpam_notice"
  | "urssaf_notice"
  | "bank_statement"
  | "insurance"
  | "mutual"
  | "contract"
  | "certificate"
  | "legal"
  | "civil"
  | "admin_letter";

export type ClassificationRule = {
  id: DocumentKindCode;
  /** Human-readable Paperless type name */
  documentTypeName: string;
  /** OCR patterns — `minMatches` of these must be present */
  markers: RegExp[];
  /** Minimum number of markers that must match to qualify */
  minMatches: number;
  /** Priority — higher wins in conflicts. Range 10–100. */
  priority: number;
  /** If any of these higher-priority kinds also matched, skip this rule */
  excludedBy?: DocumentKindCode[];
  /** Suggested tags for this document type */
  tags: string[];
  /** Category for correspondent detection */
  correspondentCategory: string;
  /** Regex that captures the most likely correspondent name */
  correspondentPattern?: RegExp;
  /** Whether this document typically has financial impact */
  hasFinancialImpact: boolean;
  /** Urgency default */
  defaultUrgency: "info" | "normal" | "important" | "urgent";
};

export type ClassificationResult = {
  kind: DocumentKindCode;
  documentTypeName: string;
  priority: number;
  matchedMarkers: string[];
  correspondentHint: string | null;
  tags: string[];
  correspondentCategory: string;
  hasFinancialImpact: boolean;
  defaultUrgency: "info" | "normal" | "important" | "urgent";
};

// ---------------------------------------------------------------------------
// Rules — ordered by priority descending
// ---------------------------------------------------------------------------

export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ── 1. Bulletin de salaire (priority 100) ─────────────────────────────────
  {
    id: "pay_slip",
    documentTypeName: "Bulletin de salaire",
    priority: 100,
    minMatches: 3,
    markers: [
      /BULLETIN\s+DE\s+PAIE/i,
      /BULLETIN\s+DE\s+SALAIRE/i,
      /BULLETIN\s+SALAIRE/i,
      /\bNET\s+[AÀ]\s+PAYER\b/i,
      /\bSALAIRE\s+BRUT\b/i,
      /\bBRUT\s+IMPOSABLE\b/i,
      /\bCOTISATIONS?\s+SALARI/i,
      /\bEMPLOYEUR\b/i,
      /\bSALARI[ÉE]\b/i,
      /\bPERIODE\s+DE\s+PAIE\b/i,
      /\bDATE\s+DE\s+PAIE\b/i,
      /\bSIRET\b/i,
      /\bPRÉLÈVEMENT\s+[AÀ]\s+LA\s+SOURCE\b/i,
    ],
    tags: ["salaire", "paie", "bulletin de salaire"],
    correspondentCategory: "employer",
    correspondentPattern: /\bEMPLOYEUR\b[:\s]*\n?([A-ZÀ-ÿa-z][A-ZÀ-ÿa-z\s\d\.,'''&()-]{3,70})/i,
    hasFinancialImpact: true,
    defaultUrgency: "normal",
  },

  // ── 2. Facture (priority 90) ───────────────────────────────────────────────
  {
    id: "invoice",
    documentTypeName: "Facture",
    priority: 90,
    minMatches: 2,
    excludedBy: ["pay_slip"],
    markers: [
      /\bFACTURE\b/i,
      /\bNUM[EÉ]RO\s+DE\s+FACTURE\b/i,
      /\bN[°O]\s*FACTURE\b/i,
      /\bTOTAL\s+TTC\b/i,
      /\bMONTANT\s+TTC\b/i,
      /\bTVA\s+[\d,.]+\s*%/i,
      /\b[AÀ]\s+PAYER\s+AVANT\b/i,
      /\b[EÉ]CH[EÉ]ANCE\b/i,
      /\bBON\s+DE\s+COMMANDE\b/i,
      /\bBON\s+DE\s+LIVRAISON\b/i,
    ],
    tags: ["Facture", "paiement"],
    correspondentCategory: "supplier",
    hasFinancialImpact: true,
    defaultUrgency: "important",
  },

  // ── 3. Relance / mise en demeure (priority 85) ────────────────────────────
  {
    id: "demand_letter",
    documentTypeName: "Relance / mise en demeure",
    priority: 85,
    minMatches: 2,
    excludedBy: ["pay_slip"],
    markers: [
      /MISE\s+EN\s+DEMEURE/i,
      /HUISSIER\s+DE\s+JUSTICE/i,
      /COMMISSAIRE\s+DE\s+JUSTICE/i,
      /PROC[EÉ]DURE\s+JUDICIAIRE/i,
      /\bIMPAY[EÉ]\b/i,
      /\bRELANCE\b/i,
      /\bSOMMAT(ION|E)\b/i,
      /DERNIER\s+RAPPEL/i,
      /VOTRE\s+DETTE\b/i,
      /SOLDE\s+D[UÛ]\b/i,
      /\bINCIDENT\s+DE\s+PAIEMENT\b/i,
    ],
    tags: ["relance", "impayé", "À traiter"],
    correspondentCategory: "creditor",
    hasFinancialImpact: true,
    defaultUrgency: "urgent",
  },

  // ── 4. Avis d'imposition / DGFIP (priority 80) ────────────────────────────
  {
    id: "tax_notice",
    documentTypeName: "Avis d'imposition",
    priority: 80,
    minMatches: 2,
    excludedBy: ["pay_slip"],
    markers: [
      /AVIS\s+D[''']\s*IMPOSITION/i,
      /IMP[OÔ]T\s+SUR\s+LE\s+REVENU/i,
      /DIRECTION\s+G[EÉ]N[EÉ]RALE\s+DES\s+FINANCES\s+PUBLIQUES/i,
      /CENTRE\s+DES\s+FINANCES\s+PUBLIQUES/i,
      /DGFiP/i,
      /impots\.gouv\.fr/i,
      /TAXE\s+FONCI[EÈ]RE/i,
      /TAXE\s+D[''']\s*HABITATION/i,
      /TAXE\s+SUR\s+LES\s+LOGEMENTS\s+VACANTS/i,
      /R[EÉ]F[EÉ]RENCE\s+DES\s+REVENUS/i,
    ],
    tags: ["impôts", "fiscalité"],
    correspondentCategory: "tax_office",
    correspondentPattern: /CENTRE\s+DES\s+FINANCES\s+PUBLIQUES\s+([\w\s\-]+)/i,
    hasFinancialImpact: true,
    defaultUrgency: "important",
  },

  // ── 5. Avis CAF (priority 75) ──────────────────────────────────────────────
  {
    id: "caf_notice",
    documentTypeName: "Avis CAF",
    priority: 75,
    minMatches: 2,
    excludedBy: ["pay_slip"],
    markers: [
      /(^|\W)CAF(\W|$)/,
      /CAISSE\s+D[''']\s*ALLOCATIONS\s+FAMILIALES/i,
      /caf\.fr/i,
      /\bALLOCATIONS?\s+FAMILIALES?\b/i,
      /\bAPL\b/,
      /\bRSA\b/,
      /PRIME\s+D[''']\s*ACTIVIT[EÉ]/i,
      /ALLOCATION\s+D[''']\s*[EÉ]DUCATION/i,
      /PRESTATIONS?\s+FAMILIALES?/i,
      /\bALLOCATAIRE\b/i,
    ],
    tags: ["CAF", "Administratif"],
    correspondentCategory: "family_allowance",
    hasFinancialImpact: true,
    defaultUrgency: "normal",
  },

  // ── 6. CPAM / Assurance Maladie (priority 70) ─────────────────────────────
  {
    id: "cpam_notice",
    documentTypeName: "Attestation CPAM",
    priority: 70,
    minMatches: 2,
    excludedBy: ["pay_slip"],
    markers: [
      /\bCPAM\b/i,
      /ASSURANCE\s+MALADIE/i,
      /\bameli\.fr\b/i,
      /\bAMELI\b/i,
      /ATTESTATION\s+DE\s+DROITS/i,
      /DROITS\s+[OÀ]\s+L[''']\s*ASSURANCE\s+MALADIE/i,
      /INDEMNIT[EÉ]S?\s+JOURNALI[EÈ]RES?/i,
      /REMBOURSEMENT\s+MALADIE/i,
      /\bS[EÉ]CURIT[EÉ]\s+SOCIALE\b/i,
    ],
    tags: ["Santé", "CPAM", "Administratif"],
    correspondentCategory: "health_insurance",
    hasFinancialImpact: true,
    defaultUrgency: "normal",
  },

  // ── 7. URSSAF (priority 65) ────────────────────────────────────────────────
  {
    id: "urssaf_notice",
    documentTypeName: "Courrier URSSAF",
    priority: 65,
    minMatches: 2,
    excludedBy: ["pay_slip", "invoice"],
    markers: [
      /\bURSSAF\b/i,
      /urssaf\.fr/i,
      /APPEL\s+DE\s+COTISATIONS?/i,
      /[EÉ]CH[EÉ]ANCIER\s+URSSAF/i,
      /MISE\s+EN\s+DEMEURE\s+URSSAF/i,
      /COMPTE\s+COTISANT/i,
      /COTISATIONS?\s+PATRONALES?/i,
      /D[EÉ]CLARATION\s+SOCIALE/i,
      /CONTRIBUTION\s+SOCIALE/i,
    ],
    tags: ["URSSAF", "Administratif"],
    correspondentCategory: "urssaf",
    hasFinancialImpact: true,
    defaultUrgency: "important",
  },

  // ── 8. Relevé bancaire (priority 60) ──────────────────────────────────────
  {
    id: "bank_statement",
    documentTypeName: "Relevé bancaire",
    priority: 60,
    minMatches: 2,
    excludedBy: ["pay_slip"],
    markers: [
      /RELEV[EÉ]\s+DE\s+COMPTE/i,
      /RELEV[EÉ]\s+BANCAIRE/i,
      /SOLDE\s+PR[EÉ]C[EÉ]DENT/i,
      /SOLDE\s+EN\s+FIN/i,
      /NOUVEAU\s+SOLDE/i,
      /\bIBAN\b/i,
      /\bBIC\b/i,
      /\bRIB\b/i,
      /[EÉ]CRITURES\s+DU\s+MOIS/i,
      /\bLECTURE\s+DE\s+COMPTE\b/i,
      /\bPR[EÉ]L[EÈ]VEMENT\s+AUTOMATIQUE\b/i,
      /TABLEAU\s+D[''']\s*AMORTISSEMENT/i,
      /[EÉ]CH[EÉ]ANCIER\s+DE\s+PRET/i,
    ],
    tags: ["Banque", "Relevé"],
    correspondentCategory: "bank",
    correspondentPattern: /(Cr[eé]dit\s+Agricole|BNP\s+Paribas|Soci[eé]t[eé]\s+G[eé]n[eé]rale|LCL|Banque\s+Populaire|Caisse\s+d[''']\s*[EÉ]pargne|CIC|Boursorama|Hello\s+Bank|ING|Fortuneo|La\s+Banque\s+Postale)/i,
    hasFinancialImpact: true,
    defaultUrgency: "normal",
  },

  // ── 9. Assurance (priority 55) ─────────────────────────────────────────────
  {
    id: "insurance",
    documentTypeName: "Document d'assurance",
    priority: 55,
    minMatches: 2,
    excludedBy: ["pay_slip", "invoice", "demand_letter"],
    markers: [
      /\bASSURANCE\b/i,
      /\bASSSUR[EÉ]\b/i,
      /CONTRAT\s+D[''']\s*ASSURANCE/i,
      /PRIME\s+D[''']\s*ASSURANCE/i,
      /\bSINISTRE\b/i,
      /\bINDEMNIT[EÉ]\b/i,
      /FRANCHISE\b/i,
      /\bGARANTIE\b/i,
      /\bCONTRAT\s+AUTO\b/i,
      /\bCONTRAT\s+HABITATION\b/i,
      /\bMULTIRISQUE\b/i,
    ],
    tags: ["Assurance"],
    correspondentCategory: "insurance",
    hasFinancialImpact: true,
    defaultUrgency: "normal",
  },

  // ── 10. Mutuelle / Prévoyance (priority 50) ───────────────────────────────
  {
    id: "mutual",
    documentTypeName: "Document mutuelle/prévoyance",
    priority: 50,
    minMatches: 2,
    excludedBy: ["pay_slip", "invoice", "demand_letter", "cpam_notice"],
    markers: [
      /\bMUTUELLE\b/i,
      /\bPR[EÉ]VOYANCE\b/i,
      /COMPL[EÉ]MENTAIRE\s+SANT[EÉ]/i,
      /REMBOURSEMENT\s+DENTAIRE/i,
      /REMBOURSEMENT\s+OPTIQUE/i,
      /CARTE\s+MUTUELLE/i,
      /TIERS\s+PAYANT/i,
      /COTISATION\s+MUTUELLE/i,
    ],
    tags: ["Santé", "Mutuelle"],
    correspondentCategory: "mutual",
    hasFinancialImpact: true,
    defaultUrgency: "normal",
  },

  // ── 11. Contrat (priority 45) ─────────────────────────────────────────────
  {
    id: "contract",
    documentTypeName: "Contrat",
    priority: 45,
    minMatches: 2,
    excludedBy: ["pay_slip", "invoice", "insurance", "mutual"],
    markers: [
      /\bCONTRAT\b/i,
      /ENTRE\s+LES\s+SOUSSIGN[EÉ]S/i,
      /CONDITIONS\s+G[EÉ]N[EÉ]RALES/i,
      /CONDITIONS\s+PARTICULI[EÈ]RES/i,
      /\bSIGNATURE\b/i,
      /\bPARTIES\b/i,
      /ENGAGEMENT\s+CONTRACTUEL/i,
      /\bDURENT\b.*\bCONTRAT\b/i,
    ],
    tags: ["Contrat"],
    correspondentCategory: "company",
    hasFinancialImpact: false,
    defaultUrgency: "normal",
  },

  // ── 12. Attestation / Certificat (priority 40) ────────────────────────────
  {
    id: "certificate",
    documentTypeName: "Attestation / Certificat",
    priority: 40,
    minMatches: 2,
    excludedBy: ["pay_slip", "invoice", "cpam_notice", "caf_notice"],
    markers: [
      /\bATTESTATION\b/i,
      /\bCERTIFICAT\b/i,
      /CERTIFIE\s+EXACT/i,
      /\bJE\s+SOUSSIGN[EÉ]\b/i,
      /\bJUSTIFICATIF\b/i,
      /ATTESTATION\s+DE\s+TRAVAIL/i,
      /ATTESTATION\s+DE\s+SALAIRE/i,
      /CERTIF.*SCOLARIT[EÉ]/i,
    ],
    tags: ["Attestation"],
    correspondentCategory: "administration",
    hasFinancialImpact: false,
    defaultUrgency: "normal",
  },

  // ── 13. Juridique (priority 35) ───────────────────────────────────────────
  {
    id: "legal",
    documentTypeName: "Document juridique",
    priority: 35,
    minMatches: 2,
    excludedBy: ["pay_slip", "demand_letter"],
    markers: [
      /\bNOTAIRE\b/i,
      /\bAVOCAT\b/i,
      /\bTRIBUNAL\b/i,
      /\bJUGEMENT\b/i,
      /\bASSIGNATION\b/i,
      /\bHUISSIER\b/i,
      /\bSAISIE\b/i,
      /\bOPPOSITION\b/i,
      /PROC[EÉ]DURE\s+(CIVILE|P[EÉ]NALE)/i,
      /\bT[EE]STAMENT\b/i,
      /\bSUCCESSION\b/i,
      /ACTE\s+NOTARI[EÉ]/i,
    ],
    tags: ["Juridique"],
    correspondentCategory: "legal",
    hasFinancialImpact: false,
    defaultUrgency: "important",
  },

  // ── 14. État civil / Identité (priority 30) ───────────────────────────────
  {
    id: "civil",
    documentTypeName: "Document d'identité / état civil",
    priority: 30,
    minMatches: 2,
    excludedBy: ["pay_slip", "certificate"],
    markers: [
      /ACTE\s+DE\s+NAISSANCE/i,
      /ACTE\s+DE\s+MARIAGE/i,
      /CARTE\s+D[''']\s*IDENTIT[EÉ]/i,
      /PASSEPORT/i,
      /PERMIS\s+DE\s+CONDUIRE/i,
      /CARTE\s+DE\s+S[EÉ]JOUR/i,
      /\bNUMERO\s+DE\s+S[EÉ]CURIT[EÉ]\s+SOCIALE\b/i,
      /\bNIR\b/i,
    ],
    tags: ["Identité"],
    correspondentCategory: "administration",
    hasFinancialImpact: false,
    defaultUrgency: "info",
  },

  // ── 15. Courrier administratif générique (priority 10) ────────────────────
  {
    id: "admin_letter",
    documentTypeName: "Courrier administratif",
    priority: 10,
    minMatches: 1,
    markers: [
      /MADAME|MONSIEUR/i,
      /VEUILLEZ\s+AGRÉER/i,
      /NOUS\s+VOUS\s+INFORMONS/i,
      /NOUS\s+AVONS\s+LE\s+PLAISIR/i,
      /SUITE\s+À\s+VOTRE\s+DEMANDE/i,
      /\bCOURRIER\b/i,
    ],
    tags: ["Courrier"],
    correspondentCategory: "unknown",
    hasFinancialImpact: false,
    defaultUrgency: "info",
  },
];

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

function runMarkers(markers: RegExp[], ocr: string): string[] {
  return markers
    .map((re) => { const m = ocr.match(re); return m ? m[0] : null; })
    .filter(Boolean) as string[];
}

/**
 * Classify a document based on its OCR text.
 * Returns the best matching classification, or null if nothing qualifies.
 *
 * Rules are evaluated in priority order. The first rule with ≥ minMatches
 * that is not excluded by a higher-priority match is returned.
 */
export function classifyDocumentFromOCR(
  ocr: string,
  titleHint?: string | null
): ClassificationResult | null {
  const text = `${ocr}\n${titleHint ?? ""}`.normalize("NFC");

  // Evaluate all rules
  const candidates: Array<ClassificationRule & { matchedMarkers: string[] }> = [];

  for (const rule of CLASSIFICATION_RULES) {
    const matched = runMarkers(rule.markers, text);
    if (matched.length >= rule.minMatches) {
      candidates.push({ ...rule, matchedMarkers: matched });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by priority descending
  candidates.sort((a, b) => b.priority - a.priority);

  // Pick the highest-priority candidate that isn't excluded by another match
  const matchedKinds = new Set(candidates.map((c) => c.id));

  for (const candidate of candidates) {
    const isExcluded =
      candidate.excludedBy?.some((excluderId) => matchedKinds.has(excluderId)) ?? false;
    if (!isExcluded) {
      // Extract correspondent hint from OCR if pattern available
      let correspondentHint: string | null = null;
      if (candidate.correspondentPattern) {
        const m = text.match(candidate.correspondentPattern);
        if (m) correspondentHint = m[1]?.trim().replace(/\s+/g, " ").slice(0, 60) ?? null;
      }
      return {
        kind: candidate.id,
        documentTypeName: candidate.documentTypeName,
        priority: candidate.priority,
        matchedMarkers: candidate.matchedMarkers,
        correspondentHint,
        tags: candidate.tags,
        correspondentCategory: candidate.correspondentCategory,
        hasFinancialImpact: candidate.hasFinancialImpact,
        defaultUrgency: candidate.defaultUrgency,
      };
    }
  }

  return null;
}

/**
 * Return all matching classifications sorted by priority (for diagnostics).
 */
export function getAllMatchingClassifications(ocr: string): Array<ClassificationResult & { excluded: boolean }> {
  const text = ocr.normalize("NFC");
  const candidates: Array<ClassificationRule & { matchedMarkers: string[] }> = [];

  for (const rule of CLASSIFICATION_RULES) {
    const matched = runMarkers(rule.markers, text);
    if (matched.length >= rule.minMatches) {
      candidates.push({ ...rule, matchedMarkers: matched });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const matchedKinds = new Set(candidates.map((c) => c.id));

  return candidates.map((c) => ({
    kind: c.id,
    documentTypeName: c.documentTypeName,
    priority: c.priority,
    matchedMarkers: c.matchedMarkers,
    correspondentHint: null,
    tags: c.tags,
    correspondentCategory: c.correspondentCategory,
    hasFinancialImpact: c.hasFinancialImpact,
    defaultUrgency: c.defaultUrgency,
    excluded: c.excludedBy?.some((id) => matchedKinds.has(id)) ?? false,
  }));
}
