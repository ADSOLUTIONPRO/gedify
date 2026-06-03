import "server-only";

import type {
  AnalyzeContext,
  AnalyzeResult,
  AIProvider,
} from "./ai-provider";
import { getActiveSystemPrompt } from "./prompts/prompt-registry";
import { getDocumentAnalysisJsonSchema } from "./schemas/document-analysis-schema";
import { parseAndMap, AIStructuredOutputError } from "./parse-ai-analysis";

/**
 * Real OpenAI provider.
 *
 * Calls /v1/chat/completions with Structured Outputs (response_format =
 * json_schema) and validates the response with Zod via `parseAndMap`. On any
 * schema violation, throws a controlled error so the wrapper can fall back
 * to the mock provider and refuse auto-application.
 */

function getApiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

function getModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

function getBaseUrl(): string {
  return process.env.OPENAI_BASE_URL?.replace(/\/+$/, "") ?? "https://api.openai.com";
}

function getMaxInputChars(): number {
  const raw = process.env.OPENAI_MAX_INPUT_CHARS;
  if (!raw) return 16_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16_000;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n[...tronqué à ${max} caractères]`;
}

function buildUserPayload(context: AnalyzeContext): string {
  const max = getMaxInputChars();
  return [
    `Titre : ${context.title || "(sans titre)"}`,
    context.fileName ? `Fichier : ${context.fileName}` : null,
    context.correspondentName ? `Correspondant déjà connu : ${context.correspondentName}` : null,
    context.documentTypeName ? `Type déjà connu : ${context.documentTypeName}` : null,
    context.created ? `Date document : ${context.created}` : null,
    context.added ? `Date ajout : ${context.added}` : null,
    "",
    "Contenu OCR du document :",
    truncate(context.content ?? "", max),
  ]
    .filter(Boolean)
    .join("\n");
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function structuredOutputsEnabled(): boolean {
  const raw = (process.env.OPENAI_USE_STRUCTURED_OUTPUTS ?? "true").toLowerCase();
  return raw !== "false" && raw !== "0";
}

async function callOpenAI(context: AnalyzeContext): Promise<AnalyzeResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY manquant.");

  // Structured Outputs (json_schema) avec fallback automatique sur json_object
  // si le modèle ou le proxy ne supporte pas ce format. La sortie est dans
  // tous les cas validée par Zod via `parseAndMap`.
  const useStructured = structuredOutputsEnabled();

  const responseFormat = useStructured
    ? {
        type: "json_schema" as const,
        json_schema: {
          name: "document_analysis",
          strict: true,
          schema: getDocumentAnalysisJsonSchema(),
        },
      }
    : { type: "json_object" as const };

  const body = {
    model: getModel(),
    response_format: responseFormat,
    temperature: 0.1,
    messages: [
      { role: "system", content: getActiveSystemPrompt() },
      { role: "user", content: buildUserPayload(context) },
    ],
  };

  const response = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as ChatResponse;
  if (data.error?.message) {
    throw new Error(`OpenAI: ${data.error.message}`);
  }
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI: réponse vide.");
  }

  // Validation stricte par Zod. Toute non-conformité lève une erreur
  // contrôlée qui est attrapée par le wrapper `wrapWithMockFallback` et
  // dégrade vers le mock — l'application automatique est alors refusée.
  let mapped: ReturnType<typeof parseAndMap>;
  try {
    mapped = parseAndMap(raw);
  } catch (error) {
    if (error instanceof AIStructuredOutputError) {
      const detail = error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" | ");
      throw new Error(
        `OpenAI: sortie JSON invalide vs schéma (${error.issues.length} erreur${
          error.issues.length > 1 ? "s" : ""
        }). ${detail}`
      );
    }
    throw error;
  }

  return {
    ...mapped.result,
    provider: `openai:${getModel()}`,
    warnings: mapped.warnings.map((w) => ({ code: w.code, message: w.message })),
    autoApplyEligible: mapped.autoApplyEligible,
  };
}

export const openAIProvider: AIProvider = {
  name: "openai",
  isMock: false,
  isExternal: true,
  async analyzeDocument(context) {
    return callOpenAI(context);
  },
};

export function isOpenAIConfigured(): boolean {
  return Boolean(getApiKey());
}
