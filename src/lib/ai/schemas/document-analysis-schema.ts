import { z } from "zod";

/**
 * Sortie JSON structurée stricte pour l'analyse documentaire IA.
 *
 * Ce schéma est utilisé :
 *  1. Côté OpenAI : converti en JSON Schema et injecté dans
 *     `response_format: { type: "json_schema" }` (Structured Outputs).
 *  2. Côté serveur : validation systématique avec Zod via
 *     `parseAiAnalysisResponse()`.
 *
 * Toute évolution du schéma DOIT être synchronisée avec le mapper
 * `parse-ai-analysis.ts` qui adapte la sortie riche vers `AnalyzeResult`.
 *
 * Règles obligatoires :
 *  - Confiance numérique sur [0, 1] pour chaque bloc critique.
 *  - Champs `needsReview` propagés à `globalConfidence` et `autoApplyEligible`.
 *  - `warnings` non vide ⇒ jamais d'application automatique.
 */

const ConfidenceNumber = z
  .number()
  .min(0)
  .max(1)
  .describe(
    "Niveau de confiance numérique normalisé entre 0 (aucune preuve) et 1 (preuves fortes et concordantes)."
  );

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD")
  .describe("Date ISO (YYYY-MM-DD).");

const DisplayDate = z
  .string()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Format attendu : DD/MM/YYYY")
  .describe("Date au format français (DD/MM/YYYY).");

const Currency = z
  .string()
  .min(1)
  .max(8)
  .describe("Code devise (EUR, USD…). EUR par défaut.");

export const IssuerSchema = z.object({
  name: z
    .string()
    .nullable()
    .describe("Nom littéral de l'émetteur tel que lu sur le document, sinon null."),
  type: z
    .enum([
      "administration",
      "tax_office",
      "social_security",
      "family_allowance",
      "employment",
      "bank",
      "notary",
      "utility",
      "telecom",
      "insurance",
      "energy",
      "water",
      "court",
      "bailiff",
      "company",
      "individual",
      "unknown",
    ])
    .describe("Catégorie de l'émetteur."),
  confidence: ConfidenceNumber,
  evidence: z
    .array(z.string().min(1))
    .max(8)
    .describe("Citations textuelles (1 à 8) prouvant l'identification de l'émetteur."),
});

export const RecipientSchema = z.object({
  name: z
    .string()
    .nullable()
    .describe("Nom du destinataire, sinon null."),
});

export const CorrespondentSchema = z.object({
  name: z
    .string()
    .nullable()
    .describe("Nom canonique du correspondant PRINCIPAL à utiliser pour Paperless (ex. 'DGFIP', 'CAF')."),
  secondary: z
    .array(z.string().min(1))
    .max(6)
    .describe("Correspondants SECONDAIRES mentionnés (ex. notaire + vendeur, avocat + client). [] si aucun."),
  category: z
    .enum([
      "impots",
      "caf",
      "cpam",
      "france_travail",
      "urssaf",
      "banque",
      "notaire",
      "energie",
      "eau",
      "telecom",
      "assurance",
      "justice",
      "huissier",
      "autre_administration",
      "entreprise",
      "particulier",
      "inconnu",
    ])
    .describe("Famille du correspondant (alignée avec les règles métiers)."),
  confidence: ConfidenceNumber,
  evidence: z
    .array(z.string().min(1))
    .max(8)
    .describe("Citations textuelles prouvant le rattachement à cette famille."),
  needsReview: z
    .boolean()
    .describe(
      "true si la détection demande un contrôle humain (preuves faibles, ambiguïté, conflit)."
    ),
});

export const ClassificationSchema = z.object({
  paperlessDocumentType: z
    .string()
    .nullable()
    .describe("Type Paperless suggéré (ex. 'Avis d'imposition', 'Facture', 'Relevé bancaire')."),
  tags: z
    .array(z.string().min(1))
    .max(20)
    .describe("Tags Paperless suggérés (noms en français)."),
  project: z
    .string()
    .nullable()
    .describe("Dossier/projet GED suggéré. Peut être un CHEMIN hiérarchique séparé par ' / ' (ex. 'Maison / Factures / Électricité / 2026', 'Revenus / Salaires / 2026', 'Administratif / Impôts / 2025'). Sinon null."),
  confidence: ConfidenceNumber,
  needsReview: z
    .boolean()
    .describe("true si le classement proposé doit être contrôlé avant application."),
});

export const DetectedDateSchema = z.object({
  label: z.string().min(1),
  iso: IsoDate,
  date: DisplayDate,
});

export const DetectedAmountSchema = z.object({
  label: z.string().min(1),
  amount: z.number().finite(),
  currency: Currency.default("EUR"),
  kind: z.string().min(1).nullable().optional(),
});

export const DetectedReferenceSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1).max(80),
});

export const FinancialImpactSchema = z.object({
  hasImpact: z.boolean(),
  kind: z
    .enum([
      "income",
      "expense",
      "debt",
      "refund",
      "invoice",
      "subscription",
      "due",
      "allowance",
      "benefit",
      "tax",
      "credit",
      "loan",
      "fees",
      "other",
      "none",
    ])
    .describe("Catégorie d'impact financier. 'none' si hasImpact=false."),
  amount: z.number().finite().nullable(),
  currency: Currency.default("EUR"),
  dueDate: IsoDate.nullable(),
  status: z
    .enum([
      "not_due",
      "due_soon",
      "due",
      "overdue",
      "paid",
      "partial",
      "scheduled",
      "unknown",
    ])
    .describe("Statut de paiement détecté."),
  confidence: ConfidenceNumber,
  needsReview: z
    .boolean()
    .describe("true si le montant, la date ou le statut sont ambigus."),
});

export const RecommendedActionSchema = z.object({
  type: z.enum([
    "pay",
    "reply",
    "forward",
    "verify",
    "classify",
    "follow-up",
    "sign",
    "send",
    "keep",
    "archive",
    "call",
    "prepare",
    "declare",
    "contest",
  ]),
  title: z.string().min(1).max(160),
  description: z.string().max(800).nullable().optional(),
  dueDate: IsoDate.nullable(),
  amount: z.number().finite().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

export const WarningSchema = z.object({
  code: z.enum([
    "low_confidence",
    "conflicting_evidence",
    "missing_issuer",
    "missing_amount",
    "missing_date",
    "unreliable_ocr",
    "policy_violation",
    "other",
  ]),
  message: z.string().min(1).max(400),
});

/**
 * Schéma complet de l'analyse documentaire structurée.
 */
export const DocumentAnalysisSchema = z.object({
  suggestedTitle: z
    .string()
    .min(1)
    .max(240)
    .describe("Titre métier court (sans nom de fichier ni UUID)."),
  titleConfidence: ConfidenceNumber,
  titleReason: z.string().max(400).nullable().optional(),

  documentKind: z
    .string()
    .min(1)
    .max(80)
    .describe("Type intuitif (ex. 'Avis d'imposition', 'Facture'...)."),
  documentType: z
    .string()
    .max(80)
    .nullable()
    .describe("Alias machine du type, ex. 'avis_imposition'."),

  summary: z
    .string()
    .min(1)
    .max(1200)
    .describe("Résumé factuel court, mentionne au moins un indice du correspondant."),
  plainLanguageExplanation: z
    .string()
    .max(1200)
    .nullable()
    .optional(),

  issuer: IssuerSchema,
  recipient: RecipientSchema,
  correspondent: CorrespondentSchema,
  classification: ClassificationSchema,

  dates: z.array(DetectedDateSchema).max(20),
  amounts: z.array(DetectedAmountSchema).max(20),
  references: z.array(DetectedReferenceSchema).max(20),
  people: z.array(z.string().min(1)).max(20),
  organizations: z.array(z.string().min(1)).max(20),

  urgency: z.enum(["info", "normal", "important", "urgent"]),
  financialImpact: FinancialImpactSchema,
  actions: z.array(RecommendedActionSchema).max(12),

  warnings: z
    .array(WarningSchema)
    .max(10)
    .describe(
      "Liste des problèmes détectés. Doit être vide pour autoriser l'auto-application."
    ),

  globalConfidence: ConfidenceNumber,
  autoApplyEligible: z
    .boolean()
    .describe(
      "true seulement si correspondent.confidence >= 0.7, classification.confidence >= 0.7, warnings vide, et needsReview=false sur les blocs critiques."
    ),
});

export type AIRichAnalysis = z.infer<typeof DocumentAnalysisSchema>;

/**
 * Génère le JSON Schema brut à injecter dans
 * `response_format: { type: "json_schema", json_schema: ... }`.
 *
 * OpenAI exige `additionalProperties: false` à tous les niveaux et que
 * chaque champ soit dans `required`. On post-traite donc la sortie de
 * `z.toJSONSchema()` pour respecter ces contraintes.
 */
export function getDocumentAnalysisJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(DocumentAnalysisSchema, {
    target: "draft-7",
    reused: "inline",
  });
  return tightenForOpenAI(schema as Record<string, unknown>);
}

function tightenForOpenAI(node: unknown): Record<string, unknown> {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return node as Record<string, unknown>;
  }
  const obj = { ...(node as Record<string, unknown>) };

  if (obj.type === "object") {
    const properties = (obj.properties as Record<string, unknown> | undefined) ?? {};
    const tightenedProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      tightenedProps[key] = tightenForOpenAI(value);
    }
    obj.properties = tightenedProps;
    obj.required = Object.keys(tightenedProps);
    obj.additionalProperties = false;
  }

  if (obj.type === "array" && obj.items) {
    obj.items = tightenForOpenAI(obj.items);
  }

  if (Array.isArray(obj.anyOf)) {
    obj.anyOf = (obj.anyOf as unknown[]).map((entry) => tightenForOpenAI(entry));
  }
  if (Array.isArray(obj.oneOf)) {
    obj.oneOf = (obj.oneOf as unknown[]).map((entry) => tightenForOpenAI(entry));
  }
  if (Array.isArray(obj.allOf)) {
    obj.allOf = (obj.allOf as unknown[]).map((entry) => tightenForOpenAI(entry));
  }

  // Strip Zod metadata not understood by OpenAI's strict schema validator.
  delete obj.$schema;
  delete obj.default;

  return obj;
}
