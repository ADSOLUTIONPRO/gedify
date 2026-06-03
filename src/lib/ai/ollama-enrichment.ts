import "server-only";

import { z } from "zod";
import type { AIAnalysis } from "./types";
import type { AIDetectedAmount, AIDetectedDate } from "./types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/+$/, "");
}

function getModel(): string {
  return process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
}

function getEnrichTimeoutMs(): number {
  const raw = process.env.AI_TIMEOUT_SECONDS;
  if (!raw) return 45_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : 45_000;
}

function getNumPredict(): number {
  const raw = process.env.OLLAMA_NUM_PREDICT;
  if (!raw) return 512;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 512;
}

const MAX_OCR_CHARS = Number(process.env.AI_OCR_MAX_CHARS) || 2000;

// ---------------------------------------------------------------------------
// Quick enrichment JSON schema (minimal — for single-pass completion)
// ---------------------------------------------------------------------------

const QUICK_ENRICHMENT_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["correspondentName", "summary"],
  properties: {
    correspondentName: {
      type: ["string", "null"],
      description: "Nom exact de l'émetteur principal (employeur, fournisseur…) ou null si inconnu",
    },
    summary: {
      type: "string",
      description: "Résumé factuel court en 2-3 phrases françaises",
    },
    documentTitle: {
      type: ["string", "null"],
      description: "Titre plus précis ou null pour garder l'existant",
    },
    amountsToAdd: {
      type: "array",
      description: "Montants présents dans l'OCR mais absents de l'analyse locale",
      items: {
        type: "object",
        required: ["label", "amount", "currency"],
        properties: {
          label: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    datesToAdd: {
      type: "array",
      description: "Dates présentes dans l'OCR mais absentes de l'analyse locale",
      items: {
        type: "object",
        required: ["label", "date", "iso"],
        properties: {
          label: { type: "string" },
          date: { type: "string" },
          iso: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Zod schema for response validation
// ---------------------------------------------------------------------------

const EnrichmentResponseSchema = z.object({
  correspondentName: z.string().nullable().optional().default(null),
  summary: z.string().min(1),
  documentTitle: z.string().nullable().optional().default(null),
  amountsToAdd: z
    .array(
      z.object({
        label: z.string(),
        amount: z.coerce.number().finite(),
        currency: z.string().default("EUR"),
      })
    )
    .optional()
    .default([]),
  datesToAdd: z
    .array(
      z.object({
        label: z.string(),
        date: z.string(),
        iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch("2000-01-01"),
      })
    )
    .optional()
    .default([]),
});

type EnrichmentResponse = z.infer<typeof EnrichmentResponseSchema>;

// ---------------------------------------------------------------------------
// Targeted OCR context builder
// ---------------------------------------------------------------------------

/**
 * Extract lines around given keywords (±contextLines) from the OCR text.
 * Much smaller than the full OCR — only what matters for the enrichment.
 */
function extractKeywordLines(
  ocrText: string,
  keywords: string[],
  contextLines = 2
): string {
  const lines = ocrText.split("\n");
  const relevant = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      for (
        let j = Math.max(0, i - contextLines);
        j <= Math.min(lines.length - 1, i + contextLines);
        j++
      ) {
        relevant.add(j);
      }
    }
  }

  const result = [...relevant]
    .sort((a, b) => a - b)
    .map((i) => lines[i].trim())
    .filter(Boolean)
    .join("\n");

  // Safety truncation
  return result.length > MAX_OCR_CHARS ? result.slice(0, MAX_OCR_CHARS) + "\n[...tronqué]" : result;
}

/**
 * Keyword lists per document kind — only what matters for enrichment.
 */
const ENRICHMENT_KEYWORDS: Record<string, string[]> = {
  pay_slip: [
    "employeur", "salarié", "bulletin de paie", "bulletin de salaire",
    "net à payer", "net payer", "siret", "date de paie", "période", "brut",
    "sas ", "sarl ", "sa ", "eurl ", "sasu ",
  ],
  invoice: [
    "facture", "fournisseur", "total ttc", "montant ttc", "à payer", "échéance",
    "siret", "iban", "n° facture",
  ],
  demand_letter: [
    "mise en demeure", "montant dû", "à payer avant", "relance", "impayé",
    "huissier", "dossier",
  ],
  bank_statement: [
    "solde", "iban", "relevé", "compte", "virement", "prélèvement",
  ],
  default: [
    "montant", "total", "date", "référence", "n°", "siret", "iban",
    "correspondant", "émetteur",
  ],
};

function buildTargetedOcr(ocrText: string, kind: string | null): string {
  const keywords = ENRICHMENT_KEYWORDS[kind ?? "default"] ?? ENRICHMENT_KEYWORDS.default;
  return extractKeywordLines(ocrText, keywords, 2);
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildEnrichmentPrompt(analysis: AIAnalysis, ocrText: string): string {
  const kind = analysis.detectedDocumentKind ?? "document inconnu";
  const missingFields: string[] = [];

  if (!analysis.suggestedCorrespondentName) missingFields.push("correspondant/émetteur principal");
  if (!analysis.detectedAmounts || analysis.detectedAmounts.length === 0) {
    missingFields.push("montants principaux");
  }
  if (!analysis.detectedDates || analysis.detectedDates.length === 0) {
    missingFields.push("dates clés");
  }

  const localContext = [
    `Type détecté : ${kind}`,
    `Type Paperless : ${analysis.suggestedDocumentTypeName ?? kind}`,
    analysis.suggestedCorrespondentName
      ? `Correspondant déjà détecté : ${analysis.suggestedCorrespondentName}`
      : `Correspondant : NON DÉTECTÉ — à trouver`,
    analysis.detectedAmounts?.length
      ? `Montants déjà détectés : ${analysis.detectedAmounts.map((a) => `${a.label}=${a.amount}€`).join(", ")}`
      : `Montants : NON DÉTECTÉS`,
    analysis.detectedDates?.length
      ? `Dates déjà détectées : ${analysis.detectedDates.map((d) => `${d.label}=${d.date}`).join(", ")}`
      : `Dates : NON DÉTECTÉES`,
    analysis.suggestedTagNames?.length
      ? `Tags : ${analysis.suggestedTagNames.join(", ")}`
      : "",
  ].filter(Boolean).join("\n");

  const targetedOcr = buildTargetedOcr(ocrText, kind.toLowerCase().replace(/\s+/g, "_"));

  return [
    `L'analyse locale a déjà classé ce document. NE PAS recontredire sauf preuve forte.`,
    ``,
    `ANALYSE LOCALE :`,
    localContext,
    missingFields.length > 0 ? `\nCHAMPS MANQUANTS À COMPLÉTER : ${missingFields.join(", ")}` : "",
    ``,
    `LIGNES OCR PERTINENTES :`,
    targetedOcr || "(aucune ligne pertinente trouvée)",
    ``,
    `RÈGLES :`,
    `- Pour un bulletin de salaire : correspondant = NOM EMPLOYEUR (pas URSSAF/CAF/CPAM).`,
    `- Ne pas inventer de montants absent du texte.`,
    `- Si le champ est déjà renseigné dans l'analyse locale, ne pas le modifier sauf si l'OCR donne une valeur clairement plus précise.`,
    `- Retourner JSON uniquement, aucun texte.`,
  ].filter((l) => l !== null).join("\n");
}

// ---------------------------------------------------------------------------
// Merge enrichment result into existing analysis
// ---------------------------------------------------------------------------

export function mergeEnrichmentIntoAnalysis(
  analysis: AIAnalysis,
  enrichment: EnrichmentResponse
): Partial<AIAnalysis> {
  const patch: Partial<AIAnalysis> = {};

  // Only fill gaps — never override existing good values
  if (!analysis.suggestedCorrespondentName && enrichment.correspondentName) {
    patch.suggestedCorrespondentName = enrichment.correspondentName;
  }

  if (enrichment.summary && enrichment.summary.length > 20) {
    // Replace bad summaries (mock misclassification artifacts)
    const isBadSummary =
      /avis\s+d[''']imposition/i.test(analysis.summary) ||
      /Ce document vient.*CAF/i.test(analysis.summary) ||
      /Type détecté.*:/i.test(analysis.summary); // raw mock format
    if (isBadSummary || !analysis.summary) {
      patch.summary = enrichment.summary;
    }
  }

  if (enrichment.documentTitle && !analysis.suggestedTitle) {
    patch.suggestedTitle = enrichment.documentTitle;
  }

  if (enrichment.amountsToAdd && enrichment.amountsToAdd.length > 0) {
    const existingAmountLabels = new Set(
      (analysis.detectedAmounts ?? []).map((a) => a.label.toLowerCase())
    );
    const newAmounts: AIDetectedAmount[] = enrichment.amountsToAdd
      .filter((a) => !existingAmountLabels.has(a.label.toLowerCase()))
      .map((a) => ({ label: a.label, amount: a.amount, currency: a.currency }));
    if (newAmounts.length > 0) {
      patch.detectedAmounts = [...(analysis.detectedAmounts ?? []), ...newAmounts];
    }
  }

  if (enrichment.datesToAdd && enrichment.datesToAdd.length > 0) {
    const existingDateLabels = new Set(
      (analysis.detectedDates ?? []).map((d) => d.label.toLowerCase())
    );
    const newDates: AIDetectedDate[] = enrichment.datesToAdd
      .filter((d) => !existingDateLabels.has(d.label.toLowerCase()))
      .map((d) => ({ label: d.label, date: d.date, iso: d.iso }));
    if (newDates.length > 0) {
      patch.detectedDates = [...(analysis.detectedDates ?? []), ...newDates];
    }
  }

  return patch;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

type OllamaGenerateResponse = {
  response?: string;
  error?: string;
  done?: boolean;
};

export type EnrichmentOutcome =
  | { status: "done"; patch: Partial<AIAnalysis>; durationMs: number }
  | { status: "timeout"; message: string; durationMs: number }
  | { status: "error"; message: string; durationMs: number };

/**
 * Call Ollama with a targeted enrichment prompt.
 *
 * Returns "done" with a partial update, "timeout" or "error" without throwing.
 * The caller decides whether to propagate timeout as a soft warning.
 *
 * Single API call, num_predict=512, temperature=0.
 */
export async function callOllamaEnrichment(
  analysis: AIAnalysis,
  ocrText: string
): Promise<EnrichmentOutcome> {
  const { randomUUID } = await import("node:crypto");
  const requestId = randomUUID();
  const start = Date.now();
  const model = getModel();
  const baseUrl = getBaseUrl();

  const prompt = buildEnrichmentPrompt(analysis, ocrText);
  const promptChars = prompt.length;

  console.log(
    `[AI_ENRICH_START] requestId=${requestId} docId=${analysis.documentId} model=${model} promptChars=${promptChars}`
  );

  if (promptChars > 5000) {
    console.warn(
      `[AI_ENRICH_WARN] requestId=${requestId} promptChars=${promptChars} > 5000 — contexte trop long, limiter AI_OCR_MAX_CHARS`
    );
  }

  const body = {
    model,
    prompt,
    stream: false,
    format: QUICK_ENRICHMENT_SCHEMA,
    keep_alive: process.env.OLLAMA_KEEP_ALIVE ?? "10m",
    options: {
      temperature: 0,
      num_predict: getNumPredict(),
    },
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(getEnrichTimeoutMs()),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - start;
    const isTimeout =
      msg.includes("TimeoutError") ||
      msg.includes("signal timed out") ||
      msg.includes("The operation was aborted");

    if (isTimeout) {
      console.log(`[AI_ENRICH_TIMEOUT] requestId=${requestId} durationMs=${durationMs}s`);
      return {
        status: "timeout",
        message: `Complément IA indisponible après ${Math.round(durationMs / 1000)}s. Analyse locale conservée.`,
        durationMs,
      };
    }
    console.error(`[AI_ENRICH_ERROR] requestId=${requestId} durationMs=${durationMs}: ${msg}`);
    return { status: "error", message: `Ollama connexion impossible : ${msg}`, durationMs };
  }

  const durationMs = Date.now() - start;

  if (!response.ok) {
    // If JSON schema format rejected, retry with format:"json"
    if (response.status === 400) {
      return callOllamaEnrichmentFallback(analysis, ocrText, requestId, prompt);
    }
    const text = await response.text().catch(() => "");
    console.error(`[AI_ENRICH_ERROR] requestId=${requestId} HTTP ${response.status}`);
    return {
      status: "error",
      message: `Ollama HTTP ${response.status}: ${text.slice(0, 200)}`,
      durationMs,
    };
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  if (data.error) {
    return { status: "error", message: `Ollama: ${data.error}`, durationMs };
  }

  const raw = (data.response ?? "").trim();
  console.log(`[AI_ENRICH_END] requestId=${requestId} durationMs=${durationMs} rawLen=${raw.length}`);

  if (!raw) {
    return { status: "error", message: "Ollama: réponse vide.", durationMs };
  }

  return parseAndMerge(raw, analysis, durationMs, requestId);
}

async function callOllamaEnrichmentFallback(
  analysis: AIAnalysis,
  ocrText: string,
  requestId: string,
  prompt: string
): Promise<EnrichmentOutcome> {
  const start = Date.now();
  const model = getModel();
  const baseUrl = getBaseUrl();

  const body = {
    model,
    prompt,
    stream: false,
    format: "json",
    keep_alive: process.env.OLLAMA_KEEP_ALIVE ?? "10m",
    options: { temperature: 0, num_predict: getNumPredict() },
  };

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(getEnrichTimeoutMs()),
  }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(null, { status: 500, statusText: msg });
  });

  const durationMs = Date.now() - start;
  if (!response.ok) {
    return { status: "error", message: `Ollama fallback HTTP ${response.status}`, durationMs };
  }
  const data = (await response.json()) as OllamaGenerateResponse;
  const raw = (data.response ?? "").trim();
  if (!raw) return { status: "error", message: "Ollama fallback: réponse vide.", durationMs };
  return parseAndMerge(raw, analysis, durationMs, requestId);
}

function parseAndMerge(
  raw: string,
  analysis: AIAnalysis,
  durationMs: number,
  requestId: string
): EnrichmentOutcome {
  // Extract JSON from response (model might add text around it)
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart ? raw.slice(jsonStart, jsonEnd + 1) : raw;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error(`[AI_ENRICH_PARSE_ERROR] requestId=${requestId} rawSnippet=${raw.slice(0, 200)}`);
    return { status: "error", message: "Réponse Ollama non-JSON.", durationMs };
  }

  const validation = EnrichmentResponseSchema.safeParse(parsed);
  if (!validation.success) {
    console.error(`[AI_ENRICH_PARSE_ERROR] requestId=${requestId} zodErrors=${validation.error.issues.length}`);
    return { status: "error", message: "Réponse Ollama invalide vs schéma.", durationMs };
  }

  const patch = mergeEnrichmentIntoAnalysis(analysis, validation.data);
  return { status: "done", patch, durationMs };
}
