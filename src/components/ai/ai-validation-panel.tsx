"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Coins,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import type { AIAnalysis } from "@/lib/ai/types";

type Props = {
  analysis: AIAnalysis;
};

type Feedback = { kind: "success" | "error" | "warning"; message: string } | null;

function providerBadge(provider: string | undefined): { label: string; className: string } {
  if (!provider || provider === "mock-rule-based" || provider === "local-rules") {
    return { label: "Analyse locale", className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (provider.includes("fallback-mock")) {
    return { label: "Fallback mock (non fiable)", className: "bg-rose-50 text-rose-700 border-rose-200" };
  }
  if (provider.startsWith("cloud:")) {
    const model = provider.replace("cloud:", "");
    return { label: `IA avancée (${model})`, className: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (provider.startsWith("ollama-enrich:")) {
    const model = provider.replace("ollama-enrich:", "");
    return { label: `Ollama enrichi (${model})`, className: "bg-violet-50 text-violet-700 border-violet-200" };
  }
  if (provider.includes("ollama")) {
    const model = provider.split(":")[1] ?? "?";
    return { label: `Ollama (${model})`, className: "bg-violet-50 text-violet-700 border-violet-200" };
  }
  if (provider.includes("openai")) {
    return { label: "OpenAI", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  return { label: provider, className: "bg-slate-100 text-slate-600 border-slate-200" };
}

function isCloudConfigured(): boolean {
  // Checked client-side: if env vars are set, show the cloud button
  // The actual check is server-side — client just tries and handles errors
  return true;
}

export function AIValidationPanel({ analysis }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const badge = providerBadge(analysis.provider);
  const isLocalOnly =
    !analysis.provider ||
    analysis.provider === "mock-rule-based" ||
    analysis.provider === "local-rules";

  async function send(label: string, url: string, body?: unknown) {
    setBusy(label);
    setFeedback(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          details?: string;
        };
        if (response.status === 401) {
          throw new Error("Session GED expirée — veuillez vous reconnecter.");
        }
        throw new Error(
          errorData.message ?? errorData.details ?? errorData.error ?? `HTTP ${response.status}`
        );
      }
      // Check for non-blocking enrichment timeout/error
      const data = (await response.json()) as {
        enrichmentStatus?: string | null;
        enrichmentMessage?: string | null;
      };
      if (data.enrichmentStatus === "timeout" || data.enrichmentStatus === "error") {
        setFeedback({
          kind: "warning",
          message: data.enrichmentMessage ?? "Complément IA indisponible. Analyse locale conservée.",
        });
      } else {
        setFeedback({ kind: "success", message: `${label} effectué.` });
      }
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : `${label} impossible.`,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
      {/* Provider badge */}
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
          {isLocalOnly
            ? <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            : <Brain className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          }
          {badge.label}
        </span>
        {isLocalOnly && (
          <span className="text-[11px] text-amber-600">
            Analyse locale — utilisez Ollama ou IA avancée pour enrichir
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Fast re-analysis (local rules) */}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            send("Ré-analyser", `/api/ai/analyze-document`, {
              documentId: analysis.documentId,
              force: true,
              mode: "fast",
            })
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          title="Analyse locale rapide (règles métier, <1s)"
        >
          {busy === "Ré-analyser" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Ré-analyser
        </button>

        {/* AI enrichment (Ollama) — only show when AI is configured */}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            send("Compléter avec IA", `/api/ai/analyze-document`, {
              documentId: analysis.documentId,
              force: false,
              mode: "enrich",
            })
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
          title="Complément Ollama ciblé (contexte réduit, timeout 45s non bloquant)"
        >
          {busy === "Compléter avec IA" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Compléter avec IA
        </button>

          {/* Cloud AI enrichment */}
        {isCloudConfigured() ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              send("IA avancée", `/api/ai/analyze-document`, {
                documentId: analysis.documentId,
                force: true,
                mode: "cloud",
              })
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
            title="Analyse approfondie avec IA avancée cloud (extraction bulletin de paie, meilleure précision)"
          >
            {busy === "IA avancée" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Brain className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            )}
            IA avancée
          </button>
        ) : null}

        {/* Validate classification */}
        <button
          type="button"
          disabled={busy !== null || analysis.status === "applied"}
          onClick={() =>
            send("Valider le classement", `/api/ai/validate-suggestion`, {
              analysisId: analysis.id,
              applyClassification: true,
              correspondentId: analysis.suggestedCorrespondentId ?? undefined,
              documentTypeId: analysis.suggestedDocumentTypeId ?? undefined,
              tagIds: analysis.suggestedTagIds,
            })
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.4)] transition hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60"
        >
          {busy === "Valider le classement" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Valider le classement
        </button>

        <button
          type="button"
          disabled={busy !== null || analysis.recommendedActions.length === 0}
          onClick={() =>
            send("Créer les actions", `/api/actions/from-document`, {
              analysisId: analysis.id,
            })
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "Créer les actions" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Zap className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Créer les actions ({analysis.recommendedActions.length})
        </button>

        <button
          type="button"
          disabled={busy !== null || analysis.financialImpact.length === 0}
          onClick={() =>
            send("Ajouter au budget", `/api/budget/extract-from-document`, {
              analysisId: analysis.id,
            })
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "Ajouter au budget" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Coins className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Ajouter au budget
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            send("Rejeter", `/api/ai/reject-suggestion`, { analysisId: analysis.id })
          }
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
        >
          {busy === "Rejeter" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Rejeter
        </button>
      </div>

      {/* Persistent enrichment status from stored analysis */}
      {!feedback && (analysis.enrichmentStatus === "timeout" || analysis.enrichmentStatus === "error") ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>{analysis.enrichmentMessage ?? "Complément IA indisponible. Analyse locale conservée et validable."}</span>
        </p>
      ) : null}

      {feedback ? (
        <p
          className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
            feedback.kind === "success"
              ? "bg-emerald-50 text-emerald-700"
              : feedback.kind === "warning"
                ? "bg-amber-50 text-amber-700"
                : "bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          ) : feedback.kind === "warning" ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </p>
      ) : null}
    </div>
  );
}
