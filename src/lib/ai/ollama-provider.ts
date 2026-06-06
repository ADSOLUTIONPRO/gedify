import "server-only";

import type { AnalyzeContext, AnalyzeResult, AIProvider } from "./ai-provider";
import { parseAndMapFlat, AIFlatParseError } from "./parse-ai-flat";
import { serializeContextForLLM, buildStructuredDocumentContext } from "@/lib/documents/structured-document-context";

// ─── Config ──────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/+$/, "");
}

function getModel(): string {
  return process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
}

function getTimeoutMs(): number {
  const raw = process.env.AI_TIMEOUT_SECONDS;
  if (!raw) return 45_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : 45_000;
}

// ─── JSON Schema for constrained output ──────────────────────────────────────
//
// Passed as `format` to Ollama to constrain model output.
// Ollama 0.5+ supports JSON schema objects as format parameter.
// This is significantly more reliable than format:"json" alone.

const ANALYSIS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: [
    "summary", "detectedDocumentKind", "suggestedTitle", "titleConfidence",
    "suggestedTagNames", "detectedDates", "detectedAmounts", "detectedReferences",
    "detectedPeople", "detectedOrganizations", "urgency",
    "recommendedActions", "financialImpact", "confidence",
  ],
  properties: {
    summary: { type: "string", description: "3-5 phrases factuelles en français" },
    plainLanguageExplanation: { type: "string", description: "1-3 phrases simples" },
    detectedDocumentKind: { type: "string", description: "Type du document" },
    suggestedTitle: { type: "string", description: "Titre court et lisible" },
    titleConfidence: { type: "number", minimum: 0, maximum: 1 },
    titleReason: { type: "string" },
    suggestedCorrespondentName: { type: ["string", "null"] },
    suggestedDocumentTypeName: { type: ["string", "null"] },
    suggestedTagNames: { type: "array", items: { type: "string" } },
    detectedDates: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "date", "iso"],
        properties: {
          label: { type: "string" },
          date: { type: "string", description: "DD/MM/YYYY" },
          iso: { type: "string", description: "YYYY-MM-DD" },
        },
      },
    },
    detectedAmounts: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "amount", "currency"],
        properties: {
          label: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string", default: "EUR" },
        },
      },
    },
    detectedReferences: {
      type: "array",
      items: {
        type: "object",
        required: ["label", "value"],
        properties: {
          label: { type: "string" },
          value: { type: "string" },
        },
      },
    },
    detectedPeople: { type: "array", items: { type: "string" } },
    detectedOrganizations: { type: "array", items: { type: "string" } },
    urgency: { type: "string", enum: ["info", "normal", "important", "urgent"] },
    recommendedActions: {
      type: "array",
      items: {
        type: "object",
        required: ["type", "title", "priority"],
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          dueDate: { type: ["string", "null"] },
          amount: { type: ["number", "null"] },
          priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
        },
      },
    },
    financialImpact: {
      type: "array",
      items: {
        type: "object",
        required: ["kind", "amount", "currency"],
        properties: {
          kind: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string", default: "EUR" },
          dueDate: { type: ["string", "null"] },
          creditor: { type: ["string", "null"] },
          category: { type: ["string", "null"] },
        },
      },
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  additionalProperties: false,
};

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un assistant administratif français. Tu analyses des documents administratifs français.

Règles impératives :
- Réponds UNIQUEMENT en JSON valide selon le schéma fourni.
- Ne jamais inventer de montants, dates ou références absents du texte.
- Tableaux vides [] si pas de données.
- Si bulletin de salaire détecté par pré-classification : correspondant = employeur (PAS URSSAF/CAF/CPAM).
- Si "prélèvement à la source" présent dans un bulletin de salaire : c'est un champ de paie, PAS un avis d'imposition.
- Priorité des types : Bulletin de salaire > Facture > Avis d'imposition > CAF > CPAM.
- Utiliser la pré-classification locale comme guide, pas comme contrainte absolue.
- BUDGET : "financialImpact" ne contient AU PLUS QU'UN montant : le PRINCIPAL réellement à payer/encaisser. Facture/relance → total TTC / net à payer / solde dû (kind=expense ; jamais HT/TVA/lignes). Bulletin de salaire → net à payer après impôt (kind=income, category=Salaire ; jamais brut/net imposable/cotisations). Informatif ou doute → financialImpact: []. Tous les autres montants → detectedAmounts uniquement.`;

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(context: AnalyzeContext): string {
  // Build structured context using the classification engine
  const structuredCtx = buildStructuredDocumentContext({
    id: context.documentId,
    title: context.title,
    content: context.content ?? "",
    original_file_name: context.fileName ?? undefined,
    original_filename: undefined,
    filename: undefined,
    correspondent__name: context.correspondentName ?? undefined,
    document_type__name: context.documentTypeName ?? undefined,
    created: context.created ?? undefined,
    added: context.added ?? undefined,
  });

  return serializeContextForLLM(structuredCtx);
}

// ─── Ollama API ───────────────────────────────────────────────────────────────

type OllamaGenerateResponse = {
  response?: string;
  error?: string;
  done?: boolean;
};

async function callOllama(context: AnalyzeContext): Promise<AnalyzeResult> {
  const { randomUUID } = await import("node:crypto");
  const requestId = randomUUID();
  const baseUrl = getBaseUrl();
  const model = getModel();

  const body: Record<string, unknown> = {
    model,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(context),
    stream: false,
    format: ANALYSIS_JSON_SCHEMA,
    keep_alive: process.env.OLLAMA_KEEP_ALIVE ?? "10m",
    options: {
      temperature: 0,
      num_predict: 2048,
    },
  };

  console.log(`[AI_PIPELINE] ollamaEnrichment started requestId=${requestId} docId=${context.documentId} model=${model} timeoutMs=${getTimeoutMs()}`);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(getTimeoutMs()),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("TimeoutError") || msg.includes("signal timed out") || msg.includes("The operation was aborted");
    console.error(`[AI] ollama fetch error requestId=${requestId}:`, isTimeout ? `timeout après ${getTimeoutMs()}ms` : msg);
    if (isTimeout) {
      throw new Error(`Ollama timeout : aucune réponse après ${Math.round(getTimeoutMs() / 1000)}s. Utilisez l'analyse locale ou augmentez AI_TIMEOUT_SECONDS.`);
    }
    throw new Error(`Ollama connexion impossible : ${msg}`);
  }

  if (!response.ok) {
    // Fallback: if JSON schema format not supported by this model/version,
    // retry with format:"json" (simpler, wider compatibility)
    if (response.status === 400) {
      console.warn(`[AI_PIPELINE] Ollama JSON schema format rejected (HTTP 400), retrying with format:"json"`);
      return callOllamaFallback(context, requestId);
    }
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  if (data.error) {
    throw new Error(`Ollama erreur modèle : ${data.error}`);
  }

  const raw = data.response ?? "";
  console.log(`[AI_PIPELINE] ollamaEnrichment done requestId=${requestId} docId=${context.documentId} rawLen=${raw.length}`);

  if (!raw.trim()) {
    throw new Error("Ollama : réponse vide — modèle non chargé ou contexte trop long.");
  }

  return parseOllamaResponse(raw, requestId);
}

/**
 * Fallback for older Ollama versions / models that don't support JSON schema format.
 * Uses format:"json" with the schema described in the prompt.
 */
async function callOllamaFallback(context: AnalyzeContext, requestId: string): Promise<AnalyzeResult> {
  const baseUrl = getBaseUrl();
  const model = getModel();

  const body = {
    model,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(context),
    stream: false,
    format: "json",
    keep_alive: process.env.OLLAMA_KEEP_ALIVE ?? "10m",
    options: { temperature: 0, num_predict: 2048 },
  };

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(getTimeoutMs()),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  if (data.error) throw new Error(`Ollama erreur modèle : ${data.error}`);
  const raw = data.response ?? "";
  if (!raw.trim()) throw new Error("Ollama : réponse vide.");
  return parseOllamaResponse(raw, requestId);
}

function parseOllamaResponse(raw: string, requestId: string): AnalyzeResult {
  try {
    const result = parseAndMapFlat(raw);
    console.log(`[AI_PIPELINE] ollamaEnrichment parsed requestId=${requestId} kind=${result.detectedDocumentKind} confidence=${result.confidence}`);
    return result;
  } catch (err) {
    if (err instanceof AIFlatParseError) {
      console.error(`[AI] ollama parse error requestId=${requestId}: ${err.message} | snippet: ${err.rawSnippet}`);
      throw new Error(`Réponse Ollama invalide : ${err.message}`);
    }
    throw err;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ollamaProvider: AIProvider = {
  name: "ollama",
  isMock: false,
  isExternal: true,
  async analyzeDocument(context) {
    return callOllama(context);
  },
};

export function isOllamaConfigured(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL && process.env.OLLAMA_MODEL);
}
