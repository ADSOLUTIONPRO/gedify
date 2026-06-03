import "server-only";

import type {
  AIAnalysis,
  AIConfidence,
  AIDetectedAmount,
  AIDetectedDate,
  AIDetectedReference,
  AIFinancialImpact,
  AIRecommendedAction,
  AIUrgency,
} from "./types";

export type AnalyzeContext = {
  documentId: number;
  title: string;
  content: string;
  fileName?: string | null;
  correspondentName?: string | null;
  documentTypeName?: string | null;
  tags?: string[];
  created?: string | null;
  added?: string | null;
  /**
   * Mode cloud « avancé » : envoie plus de contexte OCR et autorise plus de
   * tokens (documents complexes). Sinon le cloud reste en profondeur réduite
   * (analyse rapide). Ignoré par les providers locaux.
   */
  cloudAdvanced?: boolean;
  /** Taxonomies existantes à réutiliser en priorité (injectées dans le prompt cloud). */
  existingCorrespondents?: string[];
  existingDocumentTypes?: string[];
  existingTags?: string[];
  existingFolders?: string[];
};

export type AnalyzeResult = Pick<
  AIAnalysis,
  | "summary"
  | "plainLanguageExplanation"
  | "detectedDocumentKind"
  | "suggestedTitle"
  | "titleConfidence"
  | "titleReason"
  | "suggestedCorrespondentName"
  | "secondaryCorrespondentNames"
  | "suggestedDocumentTypeName"
  | "suggestedTagNames"
  | "detectedDates"
  | "detectedAmounts"
  | "detectedReferences"
  | "detectedPeople"
  | "detectedOrganizations"
  | "urgency"
  | "recommendedActions"
  | "financialImpact"
  | "confidence"
  | "provider"
  | "warnings"
  | "autoApplyEligible"
  | "globalConfidenceScore"
  | "suggestedFolderName"
  | "richData"
>;

export type AIProvider = {
  name: string;
  isMock: boolean;
  isExternal: boolean;
  analyzeDocument(context: AnalyzeContext): Promise<AnalyzeResult>;
};

export function getActiveAIProvider(): AIProvider {
  const requested = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  console.log("[AI] getActiveAIProvider provider=", requested);
  switch (requested) {
    case "openai": {
      if (!process.env.OPENAI_API_KEY) {
        console.log("[AI] OPENAI_API_KEY absente — fallback mock");
        return mockProvider;
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("./openai-provider") as typeof import("./openai-provider");
      return wrapWithMockFallback(mod.openAIProvider);
    }
    case "ollama": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ollamaMod = require("./ollama-provider") as typeof import("./ollama-provider");
      console.log("[AI] provider=ollama model=", process.env.OLLAMA_MODEL ?? "qwen2.5:3b");
      return wrapWithStrictHandling(ollamaMod.ollamaProvider);
    }
    case "hybrid": {
      // Hybrid: default to Ollama (local fast) — cloud via explicit mode="cloud"
      const localProvider = process.env.AI_LOCAL_PROVIDER ?? "ollama";
      if (localProvider === "ollama") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ollamaMod = require("./ollama-provider") as typeof import("./ollama-provider");
        console.log("[AI] provider=hybrid/ollama model=", process.env.OLLAMA_MODEL ?? "qwen2.5:3b");
        return wrapWithStrictHandling(ollamaMod.ollamaProvider);
      }
      return mockProvider;
    }
    case "mistral":
      return mockProvider;
    case "mock":
    default:
      return mockProvider;
  }
}

/**
 * Returns the cloud AI provider.
 * Used for mode="cloud" in analyze-document regardless of AI_PROVIDER setting.
 */
export function getCloudAIProvider(): AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("./cloud-provider") as typeof import("./cloud-provider");
  return wrapWithStrictHandling(mod.cloudProvider);
}

/**
 * Wraps an external provider so that any runtime error falls back to the rule-based mock
 * without breaking the UI. The fallback result is tagged with `provider="<name>:fallback-mock"`
 * so the UI can surface that a degraded path was used.
 */
function wrapWithMockFallback(primary: AIProvider): AIProvider {
  return {
    name: primary.name,
    isMock: false,
    isExternal: primary.isExternal,
    async analyzeDocument(context) {
      try {
        return await primary.analyzeDocument(context);
      } catch (error) {
        const fallback = await mockProvider.analyzeDocument(context);
        const reason = error instanceof Error ? error.message : String(error);
        return {
          ...fallback,
          provider: `${primary.name}:fallback-mock`,
          summary: `${fallback.summary} (Note : ${primary.name} indisponible — analyse rule-based locale utilisée. ${reason})`,
          warnings: [
            ...(fallback.warnings ?? []),
            {
              code: "policy_violation",
              message: `Fallback mock après échec ${primary.name} : ${reason.slice(0, 200)}`,
            },
          ],
          autoApplyEligible: false,
        };
      }
    },
  };
}

/**
 * Wraps an external provider WITHOUT any mock fallback.
 * Any error from the primary provider is logged and re-thrown so the caller
 * can surface a real error message rather than silently serving stale mock data.
 * Used for Ollama and any provider where AI_PROVIDER is set explicitly.
 */
function wrapWithStrictHandling(primary: AIProvider): AIProvider {
  return {
    name: primary.name,
    isMock: false,
    isExternal: primary.isExternal,
    async analyzeDocument(context) {
      try {
        return await primary.analyzeDocument(context);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[AI] ${primary.name} failed (no fallback): ${reason}`);
        throw error;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Rule-based mock provider
// ---------------------------------------------------------------------------

const KIND_KEYWORDS: Array<{ kind: string; words: string[] }> = [
  { kind: "Facture", words: ["facture", "invoice", "echeance", "montant ttc", "tva"] },
  { kind: "Avis d'imposition", words: ["avis d'impôt", "impôt sur le revenu", "déclaration de revenus", "trésor public"] },
  { kind: "Bulletin de salaire", words: ["bulletin de salaire", "fiche de paie", "salaire net", "cotisations"] },
  { kind: "Relevé bancaire", words: ["relevé de compte", "relevé bancaire", "solde précédent", "écritures"] },
  { kind: "Avis CAF", words: ["caf", "allocations familiales", "rsa", "ape", "prime d'activité"] },
  { kind: "Avis CPAM", words: ["cpam", "assurance maladie", "remboursement", "indemnités journalières"] },
  { kind: "Mise en demeure", words: ["mise en demeure", "huissier", "commissaire de justice"] },
  { kind: "Contrat", words: ["contrat", "conditions générales", "engagement contractuel"] },
  { kind: "Courrier", words: ["madame, monsieur", "veuillez agréer", "lettre"] },
  { kind: "Échéancier", words: ["échéancier", "plan de paiement", "calendrier de paiement"] },
];

const ORG_KEYWORDS: Array<{ name: string; words: string[] }> = [
  { name: "EDF", words: ["edf", "électricité de france"] },
  { name: "Engie", words: ["engie", "gdf"] },
  { name: "CAF", words: ["caf", "allocations familiales"] },
  { name: "CPAM", words: ["cpam", "assurance maladie", "ameli"] },
  { name: "Impôts", words: ["impôt", "trésor public", "direction générale des finances publiques", "dgfip"] },
  { name: "URSSAF", words: ["urssaf"] },
  { name: "Pôle Emploi", words: ["pôle emploi", "france travail"] },
  { name: "Orange", words: ["orange "] },
  { name: "SFR", words: ["sfr "] },
  { name: "Bouygues", words: ["bouygues telecom", "bouygues "] },
  { name: "Free", words: ["free mobile", "free télécom"] },
  { name: "Crédit Agricole", words: ["crédit agricole"] },
  { name: "BNP", words: ["bnp paribas"] },
  { name: "Société Générale", words: ["société générale"] },
];

const SUGGESTED_TAGS_BY_KIND: Record<string, string[]> = {
  "Facture": ["Facture"],
  "Avis d'imposition": ["Impôts", "Administratif"],
  "Bulletin de salaire": ["Travail"],
  "Relevé bancaire": ["Banque"],
  "Avis CAF": ["CAF", "Administratif"],
  "Avis CPAM": ["Santé", "Administratif"],
  "Mise en demeure": ["Juridique", "À traiter"],
  "Contrat": ["Contrat"],
  "Courrier": ["Courrier"],
  "Échéancier": ["Échéancier"],
};

function lower(text: string): string {
  return text.toLowerCase();
}

function detectKind(haystack: string): string {
  for (const { kind, words } of KIND_KEYWORDS) {
    if (words.some((word) => haystack.includes(word))) return kind;
  }
  return "Document";
}

function detectOrganizations(haystack: string): string[] {
  return ORG_KEYWORDS.filter(({ words }) => words.some((word) => haystack.includes(word))).map(
    (entry) => entry.name,
  );
}

function detectAmounts(text: string): AIDetectedAmount[] {
  const results: AIDetectedAmount[] = [];
  const seen = new Set<string>();
  const amountRegex =
    /(?<label>(?:montant\s*ttc|montant\s*ht|tva|net\s*à\s*payer|à\s*payer|solde|reste\s*à\s*payer|total\s*ttc|total|mensualité|salaire\s*net|remboursement|prime|indemnité|allocation)\s*[:=]?\s*)?(?<value>-?\d{1,3}(?:[\s. ]\d{3})*(?:[,.]\d{1,2})?)\s*(?<currency>€|EUR|euros?)/gi;
  let match: RegExpExecArray | null;
  while ((match = amountRegex.exec(text)) !== null) {
    const rawValue = (match.groups?.value ?? "0").replace(/[\s. ]/g, "").replace(",", ".");
    const value = Number.parseFloat(rawValue);
    if (!Number.isFinite(value)) continue;
    const labelRaw = (match.groups?.label ?? "Montant").trim();
    const label = labelRaw || "Montant";
    const key = `${label.toLowerCase()}-${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      label,
      amount: value,
      currency: "EUR",
    });
    if (results.length >= 12) break;
  }
  return results;
}

function detectDates(text: string): AIDetectedDate[] {
  const results: AIDetectedDate[] = [];
  const seen = new Set<string>();
  const dateRegex =
    /(?<label>(?:date\s+(?:limite|d'échéance|de\s+paiement|de\s+facturation|d'émission)|échéance|à\s+payer\s+avant)\s*[:=]?\s*)?(?<day>\d{1,2})[\/.\-](?<month>\d{1,2})[\/.\-](?<year>\d{2,4})/gi;
  let match: RegExpExecArray | null;
  while ((match = dateRegex.exec(text)) !== null) {
    const day = Number.parseInt(match.groups?.day ?? "0", 10);
    const month = Number.parseInt(match.groups?.month ?? "0", 10);
    let year = Number.parseInt(match.groups?.year ?? "0", 10);
    if (year < 100) year += 2000;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2099) continue;
    const iso = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
    if (seen.has(iso)) continue;
    seen.add(iso);
    const labelRaw = (match.groups?.label ?? "Date").trim() || "Date";
    results.push({
      label: labelRaw,
      date: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
      iso,
    });
    if (results.length >= 8) break;
  }
  return results;
}

function detectReferences(text: string): AIDetectedReference[] {
  const results: AIDetectedReference[] = [];
  const seen = new Set<string>();
  const refRegex =
    /(?<label>(?:r[ée]f[eé]rence|n[°o]\s*client|n[°o]\s*facture|n[°o]\s*contrat|n[°o]\s*allocataire|n[°o]\s*dossier|num[ée]ro\s+de\s+s[ée]curit[ée]\s+sociale|iban|bic|siret))\s*[:=]?\s*(?<value>[A-Z0-9\-\/.\s]{4,40})/gi;
  let match: RegExpExecArray | null;
  while ((match = refRegex.exec(text)) !== null) {
    const label = (match.groups?.label ?? "Référence").trim();
    const value = (match.groups?.value ?? "").trim().replace(/\s{2,}/g, " ").slice(0, 40);
    if (!value) continue;
    const key = `${label.toLowerCase()}-${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ label, value });
    if (results.length >= 6) break;
  }
  return results;
}

function inferUrgency(dates: AIDetectedDate[], kind: string): AIUrgency {
  const now = Date.now();
  const soonest = dates
    .map((entry) => new Date(entry.iso).getTime())
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort()
    .find((value) => value >= now);
  if (kind.toLowerCase().includes("mise en demeure")) return "urgent";
  if (typeof soonest === "number") {
    const daysAway = Math.round((soonest - now) / 86_400_000);
    if (daysAway <= 7) return "urgent";
    if (daysAway <= 30) return "important";
  }
  if (/facture|échéancier/i.test(kind)) return "important";
  return "normal";
}

function inferConfidence(text: string, signals: number): AIConfidence {
  if (text.length < 200 || signals === 0) return "low";
  if (signals < 3) return "medium";
  return "high";
}

function buildActions(
  kind: string,
  dates: AIDetectedDate[],
  amounts: AIDetectedAmount[],
): AIRecommendedAction[] {
  const firstDate = dates[0]?.iso ?? null;
  const firstAmount = amounts.find((a) => a.amount > 0)?.amount ?? null;
  const actions: AIRecommendedAction[] = [];
  const baseId = () => Math.random().toString(36).slice(2, 10);

  if (/facture|échéancier|mise en demeure/i.test(kind)) {
    actions.push({
      id: baseId(),
      type: "pay",
      title: firstAmount
        ? `Payer ${firstAmount.toFixed(2)} € ${firstDate ? `avant le ${dates[0].date}` : ""}`.trim()
        : "Payer ce document",
      description: "Action générée à partir de l'analyse IA. À valider avant exécution.",
      dueDate: firstDate,
      amount: firstAmount,
      priority: firstDate ? "high" : "normal",
    });
  }

  if (/courrier|caf|cpam|impôts/i.test(kind)) {
    actions.push({
      id: baseId(),
      type: "reply",
      title: "Préparer une réponse",
      description: "Vérifier le contenu et préparer un courrier de réponse si nécessaire.",
      priority: "normal",
    });
  }

  if (/contrat/i.test(kind)) {
    actions.push({
      id: baseId(),
      type: "verify",
      title: "Vérifier les conditions",
      description: "Relire les clauses principales avant signature ou conservation.",
      priority: "normal",
    });
  }

  actions.push({
    id: baseId(),
    type: "classify",
    title: "Valider le classement proposé",
    description: "Confirmer le correspondant, type et tags suggérés.",
    priority: "low",
  });

  return actions;
}

function buildFinancialImpact(
  kind: string,
  amounts: AIDetectedAmount[],
  dates: AIDetectedDate[],
  organizations: string[],
  confidence: AIConfidence,
): AIFinancialImpact[] {
  if (amounts.length === 0) return [];
  const dueDate = dates[0]?.iso ?? null;
  const primary = amounts.find((a) => /ttc|à payer|net à payer|total|solde/i.test(a.label)) ?? amounts[0];
  const creditor = organizations[0];

  if (/facture|échéancier|mise en demeure/i.test(kind)) {
    return [
      {
        kind: kind.toLowerCase().includes("mise") ? "debt" : "invoice",
        amount: primary.amount,
        currency: primary.currency,
        dueDate,
        creditor,
        category: "Dépenses",
        confidence,
      },
    ];
  }
  if (/bulletin de salaire|salaire/i.test(kind)) {
    const salaryEntry = amounts.find((a) => /salaire net|net à payer/i.test(a.label)) ?? primary;
    return [
      {
        kind: "income",
        amount: salaryEntry.amount,
        currency: salaryEntry.currency,
        category: "Salaire",
        recurrence: "monthly",
        confidence,
      },
    ];
  }
  if (/caf|allocation/i.test(kind)) {
    return [
      {
        kind: "allowance",
        amount: primary.amount,
        currency: primary.currency,
        category: "CAF",
        confidence,
      },
    ];
  }
  if (/cpam|remboursement/i.test(kind)) {
    return [
      {
        kind: "refund",
        amount: primary.amount,
        currency: primary.currency,
        category: "CPAM",
        confidence,
      },
    ];
  }
  if (/avis d'imposition|impôt|trésor public/i.test(kind)) {
    return [
      {
        kind: "tax",
        amount: primary.amount,
        currency: primary.currency,
        dueDate,
        category: "Impôts",
        confidence,
      },
    ];
  }
  return [];
}

const mockProvider: AIProvider = {
  name: "mock-rule-based",
  isMock: true,
  isExternal: false,
  async analyzeDocument(context) {
    const haystack = lower(`${context.title}\n${context.content}\n${context.fileName ?? ""}`);
    const kind = detectKind(haystack);
    const organizations = detectOrganizations(haystack);
    const amounts = detectAmounts(context.content);
    const dates = detectDates(context.content);
    const references = detectReferences(context.content);
    const signals =
      amounts.length + dates.length + references.length + organizations.length + (kind !== "Document" ? 1 : 0);
    const confidence = inferConfidence(context.content, signals);
    const urgency = inferUrgency(dates, kind);
    const tags = SUGGESTED_TAGS_BY_KIND[kind] ?? [];

    const summaryPieces: string[] = [`Type détecté : ${kind}.`];
    if (organizations.length > 0) {
      summaryPieces.push(`Émetteur probable : ${organizations[0]}.`);
    }
    if (amounts.length > 0) {
      const primary = amounts[0];
      summaryPieces.push(
        `Montant principal détecté : ${primary.amount.toFixed(2)} € (${primary.label}).`,
      );
    }
    if (dates.length > 0) {
      summaryPieces.push(`Date clé : ${dates[0].date} (${dates[0].label}).`);
    }
    const summary = summaryPieces.join(" ");

    const explanation = buildExplanation({ kind, organizations, amounts, dates });

    const recommendedActions = buildActions(kind, dates, amounts);
    const financialImpact = buildFinancialImpact(kind, amounts, dates, organizations, confidence);

    const suggestedTitle = buildMockTitle({
      kind,
      organizations,
      amounts,
      dates,
      contextCorrespondent: context.correspondentName ?? null,
    });

    return {
      summary,
      plainLanguageExplanation: explanation,
      detectedDocumentKind: kind,
      suggestedTitle,
      titleConfidence: signals >= 2 ? 0.6 : signals === 1 ? 0.4 : 0.2,
      titleReason: `Titre généré localement (mock) à partir du type « ${kind} »${
        organizations[0] ? ` et de l'organisme ${organizations[0]}` : ""
      }.`,
      warnings: [
        {
          code: "low_confidence",
          message:
            "Analyse rule-based locale (mock). Aucune validation IA — application automatique refusée.",
        },
      ],
      autoApplyEligible: false,
      suggestedCorrespondentName: organizations[0] ?? context.correspondentName ?? null,
      suggestedDocumentTypeName: kind,
      suggestedTagNames: tags,
      detectedDates: dates,
      detectedAmounts: amounts,
      detectedReferences: references,
      detectedPeople: [],
      detectedOrganizations: organizations,
      urgency,
      recommendedActions,
      financialImpact,
      confidence,
      provider: "mock-rule-based",
    };
  },
};

/**
 * Returns the local rule-based provider (no AI, no network call).
 * Used by fastAnalyzeDocument for immediate, sub-second analysis.
 */
export function getLocalRulesProvider(): AIProvider {
  return mockProvider;
}

function buildExplanation(input: {
  kind: string;
  organizations: string[];
  amounts: AIDetectedAmount[];
  dates: AIDetectedDate[];
}): string {
  const pieces: string[] = [];
  if (input.kind === "Facture") {
    pieces.push("Ce document ressemble à une facture.");
  } else if (input.kind === "Mise en demeure") {
    pieces.push("Ce document est une mise en demeure. Il demande un paiement ou une action rapide.");
  } else if (input.kind === "Avis CAF") {
    pieces.push("Ce document vient probablement de la CAF.");
  } else if (input.kind === "Bulletin de salaire") {
    pieces.push("Ce document est un bulletin de salaire.");
  } else if (input.kind === "Avis d'imposition") {
    pieces.push("Ce document est un avis d'imposition.");
  } else {
    pieces.push(`Ce document semble être un ${input.kind.toLowerCase()}.`);
  }
  if (input.organizations[0]) {
    pieces.push(`Il provient probablement de ${input.organizations[0]}.`);
  }
  if (input.amounts[0]) {
    pieces.push(`Un montant de ${input.amounts[0].amount.toFixed(2)} € est mentionné.`);
  }
  if (input.dates[0]) {
    pieces.push(`Une date importante est mentionnée : ${input.dates[0].date}.`);
  }
  pieces.push("Toutes les suggestions doivent être validées avant d'être appliquées.");
  return pieces.join(" ");
}

function buildMockTitle(input: {
  kind: string;
  organizations: string[];
  amounts: AIDetectedAmount[];
  dates: AIDetectedDate[];
  contextCorrespondent: string | null;
}): string {
  const correspondent = input.organizations[0] ?? input.contextCorrespondent ?? null;
  const amount = input.amounts.find((a) => /ttc|à payer|total|net|solde/i.test(a.label)) ?? input.amounts[0];
  const dueDate = input.dates.find((d) => /échéance|limite|à payer/i.test(d.label)) ?? input.dates[0];
  const period = dueDate
    ? new Date(dueDate.iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  const kindLower = input.kind.toLowerCase();

  if (kindLower.includes("facture")) {
    const parts = [`Facture${correspondent ? ` ${correspondent}` : ""}`];
    if (amount) parts.push(`${amount.amount.toFixed(2)} €`);
    if (dueDate) parts.push(`Échéance ${dueDate.date}`);
    return parts.join(" — ");
  }
  if (kindLower.includes("mise en demeure")) {
    return `Mise en demeure${correspondent ? ` — ${correspondent}` : ""}${
      amount ? ` — ${amount.amount.toFixed(2)} €` : ""
    }`;
  }
  if (kindLower.includes("avis d'imposition") || kindLower.includes("impôt")) {
    const year = dueDate ? new Date(dueDate.iso).getFullYear() : new Date().getFullYear();
    return `Avis d'imposition ${year} — Revenus ${year - 1}`;
  }
  if (kindLower.includes("bulletin de salaire") || kindLower.includes("salaire")) {
    return `Bulletin de salaire${period ? ` — ${period}` : ""}`;
  }
  if (kindLower.includes("relevé bancaire") || kindLower.includes("relevé")) {
    return `Relevé bancaire${correspondent ? ` ${correspondent}` : ""}${
      period ? ` — ${period}` : ""
    }`;
  }
  if (kindLower.includes("caf")) {
    return `Avis CAF${period ? ` — ${period}` : ""}`;
  }
  if (kindLower.includes("cpam")) {
    return `Attestation CPAM${period ? ` — ${period}` : ""}`;
  }
  if (kindLower.includes("contrat")) {
    return `Contrat${correspondent ? ` ${correspondent}` : ""}`;
  }
  if (kindLower.includes("échéancier")) {
    return `Échéancier${correspondent ? ` — ${correspondent}` : ""}`;
  }
  if (kindLower.includes("courrier")) {
    return `Courrier${correspondent ? ` ${correspondent}` : ""}`;
  }

  if (correspondent) {
    return `${input.kind} — ${correspondent}${period ? ` — ${period}` : ""}`;
  }
  return input.kind;
}
