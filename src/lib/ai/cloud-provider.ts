import "server-only";

import { randomUUID } from "node:crypto";
import type { AnalyzeContext, AnalyzeResult, AIProvider } from "./ai-provider";
import { parseAndMapFlat, AIFlatParseError } from "./parse-ai-flat";
import { buildUsefulOcrContext } from "./document-context-extractor";
import { parsePaySlipRichData, PAY_SLIP_CLOUD_PROMPT } from "./pay-slip-types";

// ─── Config ──────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  // Repli sur OPENAI_* : permet de n'utiliser QUE les variables OpenAI standard
  // (OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL) sans configurer AI_CLOUD_*.
  return (process.env.AI_CLOUD_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/+$/, "");
}

/**
 * Builds the correct chat completions URL regardless of whether AI_CLOUD_BASE_URL
 * already includes "/v1" (e.g. "https://openrouter.ai/api/v1") or not.
 */
function getChatCompletionsUrl(): string {
  const base = getBaseUrl();
  return base.endsWith("/v1")
    ? `${base}/chat/completions`
    : `${base}/v1/chat/completions`;
}

function getApiKey(): string | null {
  return process.env.AI_CLOUD_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
}

function getModel(): string {
  return process.env.AI_CLOUD_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

/** Cloud timeout is separate from Ollama timeout. Default: 180s. */
function getCloudTimeoutMs(): number {
  const raw = process.env.AI_CLOUD_TIMEOUT_SECONDS;
  if (!raw) return 180_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : 180_000;
}

function getMaxTokens(): number {
  const raw = process.env.AI_CLOUD_MAX_TOKENS;
  if (!raw) return 1500;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 8000) : 1500;
}

function getTemperature(): number {
  const raw = process.env.AI_CLOUD_TEMPERATURE;
  if (!raw) return 0;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(2, parsed)) : 0;
}

function getCloudOcrMaxChars(): number {
  const raw = process.env.AI_CLOUD_OCR_MAX_CHARS;
  if (!raw) return 6000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6000;
}

export function isCloudProviderConfigured(): boolean {
  // Configuré dès qu'une clé est présente (AI_CLOUD_* OU OPENAI_*) ; la base
  // par défaut est https://api.openai.com.
  return Boolean(getApiKey());
}

export function getCloudProviderConfig() {
  return {
    configured: isCloudProviderConfigured(),
    baseUrlConfigured: Boolean(process.env.AI_CLOUD_BASE_URL),
    model: process.env.AI_CLOUD_MODEL ?? null,
    maxTokens: getMaxTokens(),
    temperature: getTemperature(),
    timeoutSeconds: Math.round(getCloudTimeoutMs() / 1000),
    ocrMaxChars: getCloudOcrMaxChars(),
  };
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

function buildSystemPrompt(isPaySlip: boolean): string {
  const basePrompt = `Tu es un assistant administratif français spécialisé dans l'analyse de documents.

Réponds UNIQUEMENT en JSON valide. Aucun texte avant ou après. Aucun markdown.

Schéma principal (obligatoire) :
{
  "summary": "3-5 phrases factuelles en français",
  "plainLanguageExplanation": "1-3 phrases simples pour non-spécialiste",
  "detectedDocumentKind": "type du document",
  "suggestedTitle": "titre court et lisible",
  "titleConfidence": 0.8,
  "titleReason": "justification en 1 phrase",
  "suggestedCorrespondentName": "organisme émetteur ou null",
  "suggestedDocumentTypeName": "type Paperless ou null",
  "suggestedTagNames": ["tag1", "tag2"],
  "detectedDates": [{"label": "nom", "date": "DD/MM/YYYY", "iso": "YYYY-MM-DD"}],
  "detectedAmounts": [{"label": "nom", "amount": 123.45, "currency": "EUR"}],
  "detectedReferences": [{"label": "type", "value": "valeur"}],
  "detectedPeople": ["Nom Prénom"],
  "detectedOrganizations": ["Org"],
  "urgency": "normal",
  "recommendedActions": [{"type": "verify", "title": "Action", "description": "détail", "dueDate": null, "amount": null, "priority": "normal"}],
  "financialImpact": [{"kind": "expense", "amount": 0.00, "currency": "EUR", "label": "Total TTC", "reason": "montant final réellement dû", "requiresUserValidation": false, "dueDate": null, "creditor": null, "category": null}],
  "confidence": "high"${isPaySlip ? `,
  "paySlip": {}` : ""}
}

Règles fondamentales :
- JSON valide UNIQUEMENT, rien d'autre.
- Tableaux vides [] si pas de données.
- Ne jamais inventer de montants ou dates absents du texte.
- Priorité des règles : Bulletin de salaire > Facture > Avis d'imposition > CAF > CPAM.
- Dans un bulletin de paie, "prélèvement à la source" est un champ de paie, PAS un avis d'imposition.

RÈGLES FINANCIÈRES — CRITIQUES (budget) :
- "financialImpact" ne contient AU PLUS QU'UN SEUL objet : le montant PRINCIPAL réellement à payer ou à encaisser. NE JAMAIS créer une entrée par ligne de détail.
- Facture / relance / avis à payer / appel de cotisation : retiens le NET À PAYER / TOTAL TTC / SOLDE DÛ / MONTANT À RÉGLER / RESTE À PAYER. kind="expense". JAMAIS le HT, la TVA, les sous-totaux, les lignes d'articles, les prix unitaires, un acompte déjà versé.
- Bulletin de salaire / fiche de paie : retiens le NET À PAYER APRÈS IMPÔT (à défaut net payé / net versé). kind="income", category="Salaire". JAMAIS le salaire brut, le net imposable, le prélèvement à la source, les cotisations, les cumuls.
- Remboursement (CPAM, assurance…) : kind="refund", montant remboursé.
- Document informatif sans somme claire à régler/encaisser (attestation, convocation, notification, contrat sans échéance immédiate…) : "financialImpact": [].
- Incertitude, ou le seul montant trouvé est un brut / net imposable / HT / TVA : "financialImpact": [] ET mets "requiresUserValidation": true sur rien (laisse vide). Le montant va alors UNIQUEMENT dans "detectedAmounts".
- TOUS les autres montants (TVA, HT, brut, net imposable, cotisations, lignes de détail, anciens montants payés) → "detectedAmounts" UNIQUEMENT.
- "label" = nature du montant retenu (ex. "Total TTC", "Net à payer après impôt", "Solde dû"). "reason" = pourquoi ce montant. "requiresUserValidation"=true si doute.`;

  if (!isPaySlip) return basePrompt;

  return `${basePrompt}

${PAY_SLIP_CLOUD_PROMPT}`;
}

function detectIsPaySlip(context: AnalyzeContext): boolean {
  const text = (
    (context.content ?? "") + " " + (context.title ?? "") + " " + (context.documentTypeName ?? "")
  ).toLowerCase();
  return (
    /bulletin\s+de\s+(paie|salaire)/i.test(text) ||
    /\bnet\s+[àa]\s+payer\b/i.test(text) ||
    (/\bemployeur\b/i.test(text) && /\bsalari[ée]\b/i.test(text)) ||
    context.documentTypeName === "Bulletin de salaire"
  );
}

/**
 * Plafond OCR effectif : pleine valeur `AI_CLOUD_OCR_MAX_CHARS` en mode avancé,
 * version réduite (≤ 4000) en analyse rapide pour aller plus vite / moins cher.
 */
function effectiveOcrMaxChars(context: AnalyzeContext): number {
  const full = getCloudOcrMaxChars();
  return context.cloudAdvanced ? full : Math.min(full, 4000);
}

function effectiveMaxTokens(context: AnalyzeContext): number {
  const full = getMaxTokens();
  return context.cloudAdvanced ? full : Math.min(full, 1200);
}

function taxonomyBlock(label: string, values?: string[]): string | null {
  if (!values || values.length === 0) return null;
  // Borne défensive pour ne pas exploser le prompt.
  const list = values.slice(0, 200).join(", ");
  return `${label} : ${list}`;
}

function buildUserMessage(context: AnalyzeContext): string {
  // Use the cloud-specific OCR limit — separate from Ollama's limit
  const ocrContext = buildUsefulOcrContext(context.content ?? "", effectiveOcrMaxChars(context));
  const hasTaxonomies =
    (context.existingCorrespondents?.length ?? 0) +
      (context.existingDocumentTypes?.length ?? 0) +
      (context.existingTags?.length ?? 0) +
      (context.existingFolders?.length ?? 0) >
    0;
  return [
    `Document à analyser :`,
    `Titre : ${context.title || "(sans titre)"}`,
    context.fileName ? `Fichier : ${context.fileName}` : null,
    context.correspondentName ? `Correspondant connu : ${context.correspondentName}` : null,
    context.documentTypeName ? `Type connu : ${context.documentTypeName}` : null,
    context.created ? `Date document : ${context.created}` : null,
    hasTaxonomies ? `` : null,
    hasTaxonomies ? `Taxonomies existantes — réutilise EN PRIORITÉ ces valeurs (nom exact) avant d'en proposer de nouvelles :` : null,
    taxonomyBlock("Correspondants", context.existingCorrespondents),
    taxonomyBlock("Types de document", context.existingDocumentTypes),
    taxonomyBlock("Tags", context.existingTags),
    taxonomyBlock("Dossiers/projets", context.existingFolders),
    ``,
    `Contenu OCR :`,
    ocrContext,
  ].filter(Boolean).join("\n");
}

// ─── API call ────────────────────────────────────────────────────────────────

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

async function callCloudApi(context: AnalyzeContext): Promise<AnalyzeResult> {
  const requestId = randomUUID();
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("AI_CLOUD_API_KEY manquante — cloud provider non configuré.");

  const model = getModel();
  const isPaySlip = detectIsPaySlip(context);
  const maxTokens = effectiveMaxTokens(context);
  const temperature = getTemperature();
  const timeoutMs = getCloudTimeoutMs();
  const finalUrl = getChatCompletionsUrl();

  const systemPrompt = buildSystemPrompt(isPaySlip);
  const userMessage = buildUserMessage(context);
  const promptChars = systemPrompt.length + userMessage.length;

  console.log(
    `[AI_CLOUD_START] requestId=${requestId} docId=${context.documentId}` +
    ` model=${model} finalUrl=${finalUrl} promptChars=${promptChars}` +
    ` maxTokens=${maxTokens} timeoutSeconds=${Math.round(timeoutMs / 1000)}`
  );

  const body = {
    model,
    response_format: { type: "json_object" },
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  };

  const startMs = Date.now();
  let response: Response;

  try {
    response = await fetch(finalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startMs;
    const isTimeout =
      msg.includes("TimeoutError") ||
      msg.includes("signal timed out") ||
      msg.includes("The operation was aborted");

    if (isTimeout) {
      console.log(`[AI_CLOUD_TIMEOUT] requestId=${requestId} durationMs=${durationMs}`);
      throw new Error(
        `IA avancée indisponible après ${Math.round(timeoutMs / 1000)} secondes. ` +
        `Analyse locale conservée. (Augmentez AI_CLOUD_TIMEOUT_SECONDS si nécessaire.)`
      );
    }
    throw new Error(`Cloud AI connexion impossible : ${msg}`);
  }

  const durationMs = Date.now() - startMs;

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const isHtml = text.trimStart().startsWith("<");

    if (response.status === 402) {
      console.log(`[AI_CLOUD_END] requestId=${requestId} durationMs=${durationMs} status=402`);
      throw new Error(
        `Crédits OpenRouter insuffisants ou max_tokens trop élevé (actuellement ${maxTokens}). ` +
        `Réduisez AI_CLOUD_MAX_TOKENS ou ajoutez des crédits sur openrouter.ai.`
      );
    }
    if (response.status === 401) {
      console.log(`[AI_CLOUD_END] requestId=${requestId} durationMs=${durationMs} status=401`);
      throw new Error("AI_CLOUD_API_KEY invalide ou expirée. Vérifiez votre clé API cloud.");
    }
    if (response.status === 429) {
      console.log(`[AI_CLOUD_END] requestId=${requestId} durationMs=${durationMs} status=429`);
      throw new Error("Rate limit cloud AI atteint. Attendez quelques secondes et réessayez.");
    }
    if (isHtml) {
      console.log(`[AI_CLOUD_END] requestId=${requestId} durationMs=${durationMs} status=${response.status} html=true`);
      throw new Error(
        `Le provider cloud a retourné une page HTML (HTTP ${response.status}). ` +
        `Vérifiez AI_CLOUD_BASE_URL — URL finale appelée : ${finalUrl}`
      );
    }
    console.log(`[AI_CLOUD_END] requestId=${requestId} durationMs=${durationMs} status=${response.status}`);
    throw new Error(`Cloud AI HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as ChatResponse;
  if (data.error?.message) {
    console.log(`[AI_CLOUD_END] requestId=${requestId} durationMs=${durationMs} status=error`);
    throw new Error(`Cloud AI: ${data.error.message}`);
  }

  const raw = data.choices?.[0]?.message?.content ?? "";
  if (!raw.trim()) {
    console.log(`[AI_CLOUD_END] requestId=${requestId} durationMs=${durationMs} status=empty`);
    throw new Error("Cloud AI: réponse vide.");
  }

  console.log(`[AI_CLOUD_END] requestId=${requestId} durationMs=${durationMs} status=ok rawLen=${raw.length}`);

  // Parse flat analysis
  let flatResult: AnalyzeResult;
  try {
    flatResult = parseAndMapFlat(raw);
  } catch (err) {
    if (err instanceof AIFlatParseError) {
      throw new Error(`Cloud AI réponse invalide : ${err.message}`);
    }
    throw err;
  }

  // Parse pay slip rich data if present
  let richData: Record<string, unknown> | null = null;
  if (isPaySlip) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.paySlip) {
        const paySlip = parsePaySlipRichData(parsed.paySlip);
        if (paySlip) {
          richData = paySlip as unknown as Record<string, unknown>;
          if (paySlip.employer.name && !flatResult.suggestedCorrespondentName) {
            flatResult = { ...flatResult, suggestedCorrespondentName: paySlip.employer.name };
          }
          console.log(
            `[AI_CLOUD_END] requestId=${requestId} paySlip employer="${paySlip.employer.name}" netToPay=${paySlip.amounts.netToPay}`
          );
        }
      }
    } catch {
      console.warn(`[AI_CLOUD_END] requestId=${requestId} paySlip parse failed`);
    }
  }

  return { ...flatResult, provider: `cloud:${model}`, richData };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const cloudProvider: AIProvider = {
  name: "cloud",
  isMock: false,
  isExternal: true,
  async analyzeDocument(context) {
    return callCloudApi(context);
  },
};
