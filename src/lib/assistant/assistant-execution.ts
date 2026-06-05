import "server-only";

import type { ChatMessage } from "./assistant-types";
import { sanitizeForAi } from "@/lib/ai/sanitize-for-ai";

/* ────────────────────────────────────────────────────────────────────────
   Boucle de tool-calling OpenAI (chat/completions). Réutilise la config cloud
   existante (AI_CLOUD_*) avec override possible AI_ASSISTANT_*.
   ──────────────────────────────────────────────────────────────────────── */

function apiKey(): string | null {
  return process.env.AI_CLOUD_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
}
function baseUrl(): string {
  return (process.env.AI_CLOUD_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com").replace(/\/+$/, "");
}
function chatUrl(): string {
  const b = baseUrl();
  return b.endsWith("/v1") ? `${b}/chat/completions` : `${b}/v1/chat/completions`;
}
function model(): string {
  return process.env.AI_ASSISTANT_MODEL ?? process.env.AI_CLOUD_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}
function temperature(): number {
  const n = Number.parseFloat(process.env.AI_ASSISTANT_TEMPERATURE ?? "");
  return Number.isFinite(n) ? Math.max(0, Math.min(2, n)) : 0;
}
function maxTokens(): number {
  const n = Number.parseInt(process.env.AI_ASSISTANT_MAX_TOKENS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 8000) : 2000;
}
function timeoutMs(): number {
  const n = Number.parseInt(process.env.AI_CLOUD_TIMEOUT_SECONDS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n * 1000 : 120_000;
}

export function isAssistantConfigured(): boolean {
  return Boolean(apiKey());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type ApiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

type ApiResponse = {
  choices?: Array<{ message?: ApiMessage; finish_reason?: string }>;
  error?: { message?: string };
};

export type AssistantLoopResult = { reply: string; usedTools: string[] };

export async function runAssistantLoop(opts: {
  system: string;
  history: ChatMessage[];
  userMessage: string;
  tools: any[];
  execTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  maxRounds?: number;
}): Promise<AssistantLoopResult> {
  const key = apiKey();
  if (!key) throw new Error("Moteur IA non configuré (AI_CLOUD_API_KEY / OPENAI_API_KEY absente).");

  const messages: ApiMessage[] = [
    { role: "system", content: opts.system },
    ...opts.history.slice(-8).map((m) => ({ role: m.role, content: m.content } as ApiMessage)),
    { role: "user", content: opts.userMessage },
  ];

  const usedTools: string[] = [];
  const maxRounds = opts.maxRounds ?? 6;
  const url = chatUrl();

  for (let round = 0; round < maxRounds; round++) {
    const body = {
      model: model(),
      temperature: temperature(),
      max_tokens: maxTokens(),
      messages,
      tools: opts.tools,
      tool_choice: "auto" as const,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs()),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401) throw new Error("Clé API IA invalide ou expirée.");
      if (res.status === 429) throw new Error("Limite de débit IA atteinte, réessayez dans quelques secondes.");
      throw new Error(`Moteur IA HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as ApiResponse;
    if (data.error?.message) throw new Error(`Moteur IA : ${data.error.message}`);

    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("Réponse IA vide.");

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { reply: (msg.content ?? "").trim() || "(réponse vide)", usedTools };
    }

    // Rejoue le message assistant (avec tool_calls) puis les résultats d'outils.
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      const name = call?.function?.name ?? "";
      let args: Record<string, unknown> = {};
      try {
        args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }
      usedTools.push(name);
      let result: unknown;
      try {
        result = await opts.execTool(name, args);
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      // Filet de sécurité : masque tout secret éventuel avant envoi à l'IA.
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(sanitizeForAi(result)).slice(0, 8000) });
    }
  }

  // Boucle épuisée : on demande une réponse finale sans outils.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: model(), temperature: temperature(), max_tokens: maxTokens(), messages }),
    signal: AbortSignal.timeout(timeoutMs()),
  });
  const data = (await res.json().catch(() => ({}))) as ApiResponse;
  const reply = data.choices?.[0]?.message?.content?.trim() || "J'ai rassemblé les informations mais n'ai pas pu finaliser la réponse.";
  return { reply, usedTools };
}
