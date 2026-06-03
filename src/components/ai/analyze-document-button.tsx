"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";

type Props = {
  documentId: number;
  /** When true, skips cache and forces a fresh OpenAI call. */
  force?: boolean;
  /** "primary" gives the strong call-to-action style, "subtle" is a compact inline link. */
  variant?: "primary" | "subtle" | "compact";
  /** Override the default redirect — by default, navigates to /ia/document/[id] after success. */
  redirectTo?: string | null;
  /** Override displayed label. */
  label?: string;
};

type Feedback = { kind: "success" | "error" | "no-ocr"; message: string } | null;

export function AnalyzeDocumentButton({
  documentId,
  force,
  variant = "primary",
  redirectTo,
  label = "Analyser avec IA",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function run(forceFresh: boolean) {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/ai/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, force: forceFresh || force }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        analysis?: unknown;
        cached?: boolean;
        error?: string;
        message?: string;
      };
      if (response.status === 422 && data.error === "no-ocr") {
        setFeedback({
          kind: "no-ocr",
          message: data.message ?? "Pas de contenu OCR exploitable.",
        });
        return;
      }
      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? `HTTP ${response.status}`);
      }
      setFeedback({
        kind: "success",
        message: data.cached ? "Analyse récupérée." : "Analyse terminée.",
      });
      const target = redirectTo === null ? null : redirectTo ?? `/ia/document/${documentId}`;
      if (target) router.push(target);
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Analyse impossible.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (variant === "subtle") {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => run(false)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 transition hover:text-blue-900 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          )}
          {loading ? "Analyse..." : label}
        </button>
        {feedback?.kind === "error" || feedback?.kind === "no-ocr" ? (
          <span className="text-[11px] text-rose-700">{feedback.message}</span>
        ) : null}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => run(false)}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          )}
          {loading ? "Analyse..." : "Analyser"}
        </button>
        {feedback?.kind === "no-ocr" ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
            <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            Pas d&apos;OCR
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => run(false)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.5)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          )}
          {loading ? "Analyse en cours..." : label}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => run(true)}
          title="Forcer une nouvelle analyse (ignorer le cache)"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Forcer
          <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {feedback ? (
        <p
          className={`mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
            feedback.kind === "success"
              ? "bg-emerald-50 text-emerald-700"
              : feedback.kind === "no-ocr"
                ? "bg-amber-50 text-amber-800"
                : "bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </p>
      ) : null}
    </div>
  );
}
