import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AIStatusResponse = {
  provider: string;
  model: string | null;
  configured: boolean;
  connectionOk: boolean;
  fallback: boolean;
  baseUrlConfigured: boolean;
  error: string | null;
  // Cloud config
  cloudConfigured?: boolean;
  cloudModel?: string | null;
  cloudMaxTokens?: number;
  cloudTemperature?: number;
  cloudTimeoutSeconds?: number;
  cloudOcrMaxChars?: number;
  cloudBaseUrlConfigured?: boolean;
};

async function checkOllamaConnection(
  baseUrl: string,
  model: string
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: "Réponds uniquement OK", stream: false }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    const data = (await response.json()) as { response?: string; error?: string };
    if (data.error) return { ok: false, error: data.error };
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function getCloudConfig() {
  const maxTokensRaw = process.env.AI_CLOUD_MAX_TOKENS;
  const tempRaw = process.env.AI_CLOUD_TEMPERATURE;
  const timeoutRaw = process.env.AI_CLOUD_TIMEOUT_SECONDS;
  const ocrRaw = process.env.AI_CLOUD_OCR_MAX_CHARS;
  const maxTokens = maxTokensRaw ? Math.min(Number.parseInt(maxTokensRaw, 10) || 1500, 8000) : 1500;
  const temperature = tempRaw ? Math.max(0, Math.min(2, Number.parseFloat(tempRaw) || 0)) : 0;
  const timeoutSeconds = timeoutRaw ? (Number.parseInt(timeoutRaw, 10) || 180) : 180;
  const ocrMaxChars = ocrRaw ? (Number.parseInt(ocrRaw, 10) || 6000) : 6000;
  return {
    cloudConfigured: Boolean(process.env.AI_CLOUD_API_KEY && process.env.AI_CLOUD_BASE_URL),
    cloudBaseUrlConfigured: Boolean(process.env.AI_CLOUD_BASE_URL),
    cloudModel: process.env.AI_CLOUD_MODEL ?? null,
    cloudMaxTokens: maxTokens,
    cloudTemperature: temperature,
    cloudTimeoutSeconds: timeoutSeconds,
    cloudOcrMaxChars: ocrMaxChars,
  };
}

export async function GET(): Promise<NextResponse<AIStatusResponse>> {
  const providerName = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  const ollamaModel = process.env.OLLAMA_MODEL ?? null;
  const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL ?? "").replace(/\/+$/, "");
  const cloudConfig = getCloudConfig();

  // ── Ollama ────────────────────────────────────────────────────────────────
  if (providerName === "ollama" || providerName === "hybrid") {
    const baseUrlConfigured = Boolean(ollamaBaseUrl);
    const configured = baseUrlConfigured && Boolean(ollamaModel);
    let connectionOk = false;
    let error: string | null = null;

    if (configured) {
      const check = await checkOllamaConnection(ollamaBaseUrl, ollamaModel!);
      connectionOk = check.ok;
      error = check.error;
    } else {
      error = !baseUrlConfigured
        ? "OLLAMA_BASE_URL non configurée"
        : "OLLAMA_MODEL non configuré";
    }

    console.log(
      "[AI] status check provider=", providerName,
      "model=", ollamaModel,
      "connectionOk=", connectionOk,
      "cloudConfigured=", cloudConfig.cloudConfigured
    );

    return NextResponse.json({
      provider: providerName,
      model: ollamaModel,
      configured,
      connectionOk,
      fallback: false,
      baseUrlConfigured,
      error,
      ...cloudConfig,
    });
  }

  // ── OpenAI ────────────────────────────────────────────────────────────────
  if (providerName === "openai") {
    const apiKeyPresent = Boolean(process.env.OPENAI_API_KEY);
    return NextResponse.json({
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      configured: apiKeyPresent,
      connectionOk: false,
      fallback: !apiKeyPresent,
      baseUrlConfigured: false,
      error: apiKeyPresent ? null : "OPENAI_API_KEY absente — fallback mock actif",
      ...cloudConfig,
    });
  }

  // ── Mock ──────────────────────────────────────────────────────────────────
  return NextResponse.json({
    provider: "mock",
    model: null,
    configured: true,
    connectionOk: true,
    fallback: false,
    baseUrlConfigured: false,
    error: null,
    ...cloudConfig,
  });
}
