import "server-only";

import { extractEmployerFromOCR } from "./document-type-rules";
import type { AIDetectedAmount, AIDetectedDate, AIDetectedReference } from "../types";

// ---------------------------------------------------------------------------
// Shared extraction helpers
// ---------------------------------------------------------------------------

function findAmount(text: string, labelPatterns: string[]): number | null {
  for (const pattern of labelPatterns) {
    const re = new RegExp(`${pattern}[^\\n]*?([-]?\\d{1,3}(?:[\\s,.]\\d{3})*[,.]\\d{2})`, "i");
    const m = text.match(re);
    if (m) {
      const raw = m[1].replace(/\s/g, "").replace(",", ".");
      const n = parseFloat(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function findDate(text: string, labelPatterns: string[]): string | null {
  for (const pattern of labelPatterns) {
    const re = new RegExp(
      `${pattern}[^\\n]*?(\\d{1,2}[/.]\\d{1,2}[/.]\\d{2,4})`,
      "i"
    );
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

function findIban(text: string): string | null {
  const m = text.match(/\bIBAN[:\s]*([A-Z]{2}[0-9]{2}[A-Z0-9]{4,30})\b/i);
  return m ? m[1].replace(/\s/g, "") : null;
}

function findSiret(text: string): string | null {
  const m = text.match(/\bSIRET\b[:\s]*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5}|\d{14})/i);
  return m ? m[1].replace(/\s/g, "") : null;
}

function findLineAfter(text: string, labelRe: RegExp, maxLen = 60): string | null {
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    if (labelRe.test(lines[i])) {
      // Try same line first (after the label)
      const sameLine = lines[i].replace(labelRe, "").trim();
      if (sameLine.length > 2 && sameLine.length < maxLen) return sameLine;
      // Otherwise next line
      const next = lines[i + 1]?.trim();
      if (next && next.length > 2 && next.length < maxLen) return next;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pay slip extractor
// ---------------------------------------------------------------------------

export type PaySlipExtract = {
  employerName: string | null;
  employerSiret: string | null;
  employerApe: string | null;
  employeeName: string | null;
  employeeJob: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paymentDate: string | null;
  grossSalary: number | null;
  netToPay: number | null;
  netTaxable: number | null;
  employeeContributions: number | null;
  secondaryOrganisms: string[];
};

export function extractPaySlipFields(ocr: string): PaySlipExtract {
  const employer = extractEmployerFromOCR(ocr);

  const secondaryOrgs: string[] = [];
  if (/\bURSSAF\b/i.test(ocr)) secondaryOrgs.push("URSSAF");
  if (/\bCPAM\b|\bAssurance\s+Maladie\b/i.test(ocr)) secondaryOrgs.push("CPAM");
  if (/\bRetraite\b|\bAgirc\b|\bArrco\b|\bIrcantec\b/i.test(ocr)) secondaryOrgs.push("Retraite");
  if (/\bPr[eé]voyance\b/i.test(ocr)) secondaryOrgs.push("Prévoyance");
  if (/\bMutuelle\b/i.test(ocr)) secondaryOrgs.push("Mutuelle");

  const employeeName = findLineAfter(ocr, /\bSALARI[ÉE]\b/i, 50);
  const employeeJob = findLineAfter(ocr, /\bEMPLOI\b|\bFONCTION\b|\bPOSTE\b/i, 50);

  const paymentDate = findDate(ocr, [
    "date\\s+de\\s+paie",
    "payé\\s+le",
    "versé\\s+le",
    "virement\\s+du",
  ]);

  const periodStart = findDate(ocr, [
    "du",
    "période\\s+du",
    "début\\s+période",
  ]);

  const periodEnd = findDate(ocr, [
    "au",
    "fin\\s+période",
  ]);

  const netToPay = findAmount(ocr, [
    "net\\s+[àa]\\s+payer",
    "net\\s+payer",
    "net\\s+vers[eé]",
    "montant\\s+net",
    "total\\s+net",
  ]);

  const netTaxable = findAmount(ocr, [
    "net\\s+imposable",
    "net\\s+fiscal",
  ]);

  const grossSalary = findAmount(ocr, [
    "salaire\\s+brut",
    "brut\\s+imposable",
    "total\\s+brut",
    "r[eé]mun[eé]ration\\s+brute",
  ]);

  const employeeContributions = findAmount(ocr, [
    "cotisations\\s+salari[eé]",
    "total\\s+cotisations\\s+salari",
    "retenues",
  ]);

  return {
    employerName: employer?.name ?? null,
    employerSiret: employer?.siret ?? findSiret(ocr),
    employerApe: ocr.match(/\bAPE\b[:\s]*([A-Z0-9]{4,5})/i)?.[1] ?? null,
    employeeName,
    employeeJob,
    periodStart,
    periodEnd,
    paymentDate,
    grossSalary,
    netToPay,
    netTaxable,
    employeeContributions,
    secondaryOrganisms: secondaryOrgs,
  };
}

// ---------------------------------------------------------------------------
// Invoice extractor
// ---------------------------------------------------------------------------

export type InvoiceExtract = {
  supplierName: string | null;
  customerName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  totalHT: number | null;
  vatAmount: number | null;
  totalTTC: number | null;
  iban: string | null;
  siret: string | null;
  isOverdue: boolean;
};

export function extractInvoiceFields(ocr: string): InvoiceExtract {
  const invoiceNumber =
    ocr.match(/N[°O]\s*FACTURE[:\s]+([A-Z0-9\-\/]{3,20})/i)?.[1] ??
    ocr.match(/FACTURE\s+N[°O][:\s]+([A-Z0-9\-\/]{3,20})/i)?.[1] ??
    ocr.match(/REF[EÉ]RENCE[:\s]+([A-Z0-9\-\/]{3,20})/i)?.[1] ?? null;

  const invoiceDate = findDate(ocr, [
    "date\\s+(?:de\\s+)?facture",
    "date\\s+d[''']\s*[eé]mission",
    "[eé]mis\\s+le",
    "fait\\s+le",
  ]);

  const dueDate = findDate(ocr, [
    "[eé]ch[eé]ance",
    "[àa]\\s+payer\\s+avant\\s+le",
    "date\\s+limite\\s+de\\s+paiement",
    "r[eè]glement\\s+[àa]",
  ]);

  const totalTTC = findAmount(ocr, [
    "total\\s+ttc",
    "montant\\s+ttc",
    "net\\s+[àa]\\s+payer",
    "total\\s+[àa]\\s+payer",
  ]);

  const totalHT = findAmount(ocr, [
    "total\\s+ht",
    "montant\\s+ht",
    "sous-total\\s+ht",
    "total\\s+hors\\s+taxe",
  ]);

  const vatAmount = findAmount(ocr, [
    "tva",
    "taxe\\s+sur\\s+la\\s+valeur\\s+ajout[eé]e",
    "total\\s+tva",
    "montant\\s+tva",
  ]);

  const isOverdue =
    /RELANCE|IMPAY[EÉ]|D[EÛU]PASSEMENT|EN\s+RETARD/i.test(ocr) ||
    /SOLDE\s+D[ÛU]/i.test(ocr);

  return {
    supplierName: findLineAfter(ocr, /^(FOURNISSEUR|[EÉ]METTEUR|[EÉ]METTRICE)\s*:/im, 60),
    customerName: findLineAfter(ocr, /^(CLIENT|DESTINATAIRE|FACTURER\s+[AÀ])\s*:/im, 60),
    invoiceNumber,
    invoiceDate,
    dueDate,
    totalHT,
    vatAmount,
    totalTTC,
    iban: findIban(ocr),
    siret: findSiret(ocr),
    isOverdue,
  };
}

// ---------------------------------------------------------------------------
// Demand letter extractor
// ---------------------------------------------------------------------------

export type DemandLetterExtract = {
  creditorName: string | null;
  amountDue: number | null;
  dueDate: string | null;
  referenceNumber: string | null;
  hasProsecutionThreat: boolean;
  hasBailiffThreat: boolean;
  urgencyLevel: "normal" | "important" | "urgent";
};

export function extractDemandLetterFields(ocr: string): DemandLetterExtract {
  const amountDue = findAmount(ocr, [
    "montant\\s+d[ûu]",
    "solde\\s+d[ûu]",
    "somme\\s+de",
    "votre\\s+dette",
    "capital\\s+restant",
    "total\\s+impay[eé]",
  ]);

  const dueDate = findDate(ocr, [
    "avant\\s+le",
    "jusqu[''']\s*au",
    "[àa]\\s+compter\\s+du",
    "d[eé]lai\\s+de",
    "ultimatum",
  ]);

  const reference =
    ocr.match(/DOSSIER\s*N[°O][:\s]+([A-Z0-9\-\/]{3,20})/i)?.[1] ??
    ocr.match(/R[EÉ]F[EÉ]RENCE\s*[:\s]+([A-Z0-9\-\/]{3,20})/i)?.[1] ?? null;

  const hasBailiff = /HUISSIER|COMMISSAIRE\s+DE\s+JUSTICE/i.test(ocr);
  const hasProsecution = /PROC[EÉ]DURE\s+JUDICIAIRE|TRIBUNAL|SAISIE|OPPOSITION/i.test(ocr);
  const isMiseEnDemeure = /MISE\s+EN\s+DEMEURE/i.test(ocr);

  const urgency: DemandLetterExtract["urgencyLevel"] = hasBailiff || hasProsecution
    ? "urgent"
    : isMiseEnDemeure
      ? "important"
      : "normal";

  return {
    creditorName: null, // usually needs NLP — will be filled by correspondent rules
    amountDue,
    dueDate,
    referenceNumber: reference,
    hasProsecutionThreat: hasProsecution,
    hasBailiffThreat: hasBailiff,
    urgencyLevel: urgency,
  };
}

// ---------------------------------------------------------------------------
// Bank statement extractor
// ---------------------------------------------------------------------------

export type BankStatementExtract = {
  bankName: string | null;
  accountHolder: string | null;
  iban: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
};

export function extractBankStatementFields(ocr: string): BankStatementExtract {
  const openingBalance = findAmount(ocr, [
    "solde\\s+pr[eé]c[eé]dent",
    "solde\\s+en\\s+d[eé]but",
    "solde\\s+au\\s+01",
    "solde\\s+ouverture",
  ]);
  const closingBalance = findAmount(ocr, [
    "nouveau\\s+solde",
    "solde\\s+en\\s+fin",
    "solde\\s+actuel",
    "solde\\s+en\\s+euros",
  ]);

  const periodStart = findDate(ocr, ["du", "p[eé]riode\\s+du", "relev[eé]\\s+du"]);
  const periodEnd = findDate(ocr, ["au", "jusqu[''']au"]);

  const bankNames = [
    "Cr[eé]dit Agricole", "BNP Paribas", "Soci[eé]t[eé] G[eé]n[eé]rale",
    "LCL", "Banque Populaire", "Caisse d[''']?[EÉ]pargne", "CIC",
    "Boursorama", "Hello Bank", "ING", "Fortuneo", "La Banque Postale",
    "HSBC", "Cr[eé]dit Mutuel", "Cr[eé]dit Lyonnais",
  ];
  let bankName: string | null = null;
  for (const b of bankNames) {
    const m = ocr.match(new RegExp(`\\b(${b})\\b`, "i"));
    if (m) { bankName = m[1]; break; }
  }

  return {
    bankName,
    accountHolder: null,
    iban: findIban(ocr),
    periodStart,
    periodEnd,
    openingBalance,
    closingBalance,
  };
}

// ---------------------------------------------------------------------------
// Uniform dispatcher
// ---------------------------------------------------------------------------

export type DocumentFields =
  | ({ kind: "pay_slip" } & PaySlipExtract)
  | ({ kind: "invoice" } & InvoiceExtract)
  | ({ kind: "demand_letter" } & DemandLetterExtract)
  | ({ kind: "bank_statement" } & BankStatementExtract)
  | { kind: "other" };

export function extractDocumentFields(
  kind: string,
  ocr: string
): DocumentFields {
  switch (kind) {
    case "pay_slip":
      return { kind: "pay_slip", ...extractPaySlipFields(ocr) };
    case "invoice":
      return { kind: "invoice", ...extractInvoiceFields(ocr) };
    case "demand_letter":
      return { kind: "demand_letter", ...extractDemandLetterFields(ocr) };
    case "bank_statement":
      return { kind: "bank_statement", ...extractBankStatementFields(ocr) };
    default:
      return { kind: "other" };
  }
}

// Re-exports for convenience
export type { AIDetectedAmount, AIDetectedDate, AIDetectedReference };
