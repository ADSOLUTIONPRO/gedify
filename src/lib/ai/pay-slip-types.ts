import { z } from "zod";

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const NullableStr = z.string().nullable().optional().default(null);
const NullableNum = z.coerce.number().finite().nullable().optional().default(null);

export const PaySlipEmployeeSchema = z.object({
  name: NullableStr,
  address: NullableStr,
  socialSecurityNumber: NullableStr,
  job: NullableStr,
  qualification: NullableStr,
  entryDate: NullableStr,
  exitDate: NullableStr,
  collectiveAgreement: NullableStr,
});

export const PaySlipEmployerSchema = z.object({
  name: NullableStr,
  address: NullableStr,
  siret: NullableStr,
  apeCode: NullableStr,
  urssafNumber: NullableStr,
});

export const PaySlipAmountsSchema = z.object({
  grossSalary: NullableNum,
  employeeContributions: NullableNum,
  netTaxable: NullableNum,
  netToPay: NullableNum,
  employerCost: NullableNum,
});

export const PaySlipPaymentSchema = z.object({
  method: NullableStr,
  amount: NullableNum,
  date: NullableStr,
});

export const PaySlipPeriodSchema = z.object({
  start: NullableStr,
  end: NullableStr,
  paymentDate: NullableStr,
});

export const PaySlipFinancialImpactSchema = z.object({
  type: z.literal("income").default("income"),
  category: z.literal("salary").default("salary"),
  amount: NullableNum,
  status: z.string().default("to_review"),
});

export const PaySlipSuggestionsSchema = z.object({
  correspondent: z.object({
    type: z.string().default("new_correspondent_or_existing_match"),
    name: NullableStr,
  }),
  tags: z.array(z.string()).default(["salaire", "paie", "bulletin de salaire"]),
  documentType: z.string().default("Bulletin de salaire"),
});

/** Full structured data extracted by the cloud provider for a pay slip. */
export const PaySlipRichDataSchema = z.object({
  documentKind: z.literal("pay_slip"),
  documentType: z.literal("Bulletin de salaire"),
  employee: PaySlipEmployeeSchema,
  employer: PaySlipEmployerSchema,
  payPeriod: PaySlipPeriodSchema,
  amounts: PaySlipAmountsSchema,
  payment: PaySlipPaymentSchema,
  secondaryOrganisms: z.array(z.string()).default([]),
  attachedDocuments: z.array(z.string()).default([]),
  legalMentions: z.array(z.string()).default([]),
  financialImpact: PaySlipFinancialImpactSchema,
  suggestions: PaySlipSuggestionsSchema,
  extractedBy: z.string().default("cloud"),
  extractedAt: z.string().default(() => new Date().toISOString()),
});

export type PaySlipRichData = z.infer<typeof PaySlipRichDataSchema>;
export type PaySlipEmployee = z.infer<typeof PaySlipEmployeeSchema>;
export type PaySlipEmployer = z.infer<typeof PaySlipEmployerSchema>;
export type PaySlipAmounts = z.infer<typeof PaySlipAmountsSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isPaySlipRichData(data: unknown): data is PaySlipRichData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return d.documentKind === "pay_slip";
}

export function parsePaySlipRichData(raw: unknown): PaySlipRichData | null {
  const result = PaySlipRichDataSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** System prompt section for cloud pay slip extraction. */
export const PAY_SLIP_CLOUD_PROMPT = `
Pour un BULLETIN DE SALAIRE, tu dois extraire les données dans la section "paySlip" du JSON :

{
  "paySlip": {
    "documentKind": "pay_slip",
    "documentType": "Bulletin de salaire",
    "employee": {
      "name": "Nom Prénom du salarié",
      "address": "Adresse complète du salarié ou null",
      "socialSecurityNumber": "Numéro de sécurité sociale masqué ou null",
      "job": "Intitulé du poste ou null",
      "qualification": "Qualification/coefficient ou null",
      "entryDate": "Date d'entrée DD/MM/YYYY ou null",
      "exitDate": "Date de sortie DD/MM/YYYY ou null",
      "collectiveAgreement": "Convention collective ou null"
    },
    "employer": {
      "name": "Nom exact de l'employeur (pas URSSAF/CAF/CPAM)",
      "address": "Adresse employeur ou null",
      "siret": "Numéro SIRET 14 chiffres ou null",
      "apeCode": "Code APE/NAF ou null",
      "urssafNumber": "Numéro URSSAF ou null"
    },
    "payPeriod": {
      "start": "YYYY-MM-DD début période ou null",
      "end": "YYYY-MM-DD fin période ou null",
      "paymentDate": "YYYY-MM-DD date de paiement ou null"
    },
    "amounts": {
      "grossSalary": 0.00,
      "employeeContributions": 0.00,
      "netTaxable": 0.00,
      "netToPay": 0.00,
      "employerCost": 0.00
    },
    "payment": {
      "method": "Virement ou null",
      "amount": 0.00,
      "date": "YYYY-MM-DD ou null"
    },
    "secondaryOrganisms": ["URSSAF", "CPAM", "Retraite", ...],
    "attachedDocuments": [],
    "legalMentions": [],
    "financialImpact": {
      "type": "income",
      "category": "salary",
      "amount": 0.00,
      "status": "to_review"
    },
    "suggestions": {
      "correspondent": {"type": "new_correspondent_or_existing_match", "name": "NOM EMPLOYEUR"},
      "tags": ["salaire", "paie", "bulletin de salaire", "employeur"],
      "documentType": "Bulletin de salaire"
    }
  }
}

Règles impératives pour les bulletins de salaire :
- Le correspondant principal EST L'EMPLOYEUR (pas URSSAF, pas CAF, pas CPAM).
- URSSAF, CPAM, retraite, prévoyance = organismes secondaires (secondaryOrganisms).
- Le montant budget est le net à payer (amounts.netToPay).
- financialImpact.type = "income" toujours pour un bulletin de paie.
- Ne jamais classer comme avis d'imposition, CAF, ou document fiscal.
- Si "prélèvement à la source" apparaît = champ de paie, PAS un avis d'imposition.
`.trim();
