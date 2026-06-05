"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, X, RefreshCw } from "lucide-react";
import type { ProgressData } from "@/lib/hooks/use-gedify-progress";
import { GedifyErrorHint } from "@/components/ui/gedify-error-hint";

/* GedifyProgressModal — modale commune de progression des actions longues
   (miniature, OCR, IA, actions groupées, backup, diagnostic…). Pilotée par
   useGedifyProgress. Affiche étapes, X/N, réussis/erreurs, durée, logs, et —
   en cas d'échec — un GedifyErrorHint (cause/solution/relancer). */

type Props = {
  data: ProgressData;
  onClose: () => void;
  /** Action de relance (affiche « Relancer » en cas d'échec/partiel). */
  onRetry?: () => void;
};

const STATE_META: Record<ProgressData["state"], { label: string; tone: string }> = {
  idle: { label: "Prêt", tone: "var(--text-muted)" },
  pending: { label: "En attente", tone: "#D97706" },
  processing: { label: "En cours", tone: "var(--blue-600)" },
  success: { label: "Terminé", tone: "#16A34A" },
  partial_success: { label: "Terminé avec erreurs", tone: "#D97706" },
  failed: { label: "Échec", tone: "#DC2626" },
  cancelled: { label: "Annulé", tone: "var(--text-muted)" },
};

function useElapsed(startedAt: number | null, running: boolean): string {
  const [elapsed, setElapsed] = useState("—");
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const s = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      setElapsed(s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);
    };
    // Mises à jour via callbacks asynchrones (jamais de setState synchrone d'effet).
    const t0 = setTimeout(tick, 0);
    const interval = running ? setInterval(tick, 1000) : null;
    return () => {
      clearTimeout(t0);
      if (interval) clearInterval(interval);
    };
  }, [startedAt, running]);
  return elapsed;
}

export function GedifyProgressModal({ data, onClose, onRetry }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const terminal = data.state === "success" || data.state === "failed" || data.state === "partial_success" || data.state === "cancelled";
  const running = data.open && !terminal;
  const elapsed = useElapsed(data.startedAt, running);
  const meta = STATE_META[data.state];
  const pct = data.total && data.total > 0 ? Math.min(100, Math.round((data.current / data.total) * 100)) : null;
  const showError = data.state === "failed" || data.state === "partial_success";

  useEffect(() => {
    if (!data.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && terminal) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data.open, terminal, onClose]);

  if (!data.open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={terminal ? onClose : undefined} aria-hidden="true" />
      <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        {terminal ? (
          <button type="button" onClick={onClose} aria-label="Fermer" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100" style={{ color: "var(--text-muted)" }}>
            <X className="h-4 w-4" />
          </button>
        ) : null}

        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--bg-card-soft)" }}>
            {data.state === "success" ? (
              <CheckCircle2 className="h-5 w-5" style={{ color: "#16A34A" }} />
            ) : showError ? (
              <AlertTriangle className="h-5 w-5" style={{ color: data.state === "failed" ? "#DC2626" : "#D97706" }} />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--blue-600)" }} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>{data.title}</h2>
            {data.description ? <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>{data.description}</p> : null}
          </div>
        </div>

        {/* Étape + progression */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span style={{ color: meta.tone, fontWeight: 700 }}>{meta.label}{data.step ? ` · ${data.step}` : ""}</span>
            <span style={{ color: "var(--text-muted)" }}>
              {data.total != null ? `${data.current}/${data.total}` : null}{pct != null ? ` · ${pct}%` : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: pct != null ? `${pct}%` : running ? "40%" : "100%",
                background: data.state === "failed" ? "#DC2626" : data.state === "partial_success" ? "#D97706" : data.state === "success" ? "#16A34A" : "var(--blue-600)",
                opacity: pct == null && running ? 0.5 : 1,
              }}
            />
          </div>
        </div>

        {/* Compteurs */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
          {data.succeeded > 0 ? <span>✓ {data.succeeded} réussi(s)</span> : null}
          {data.failed > 0 ? <span className="text-rose-600">✗ {data.failed} erreur(s)</span> : null}
          <span>Durée : {elapsed}</span>
        </div>

        {/* Erreur détaillée */}
        {showError ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border p-2.5" style={{ borderColor: "#FCA5A5", background: "#FEF2F2" }}>
            <GedifyErrorHint code={data.errorCode} message={data.errorMessage} onRetry={onRetry} size="md" />
            <span className="text-[12px] font-semibold text-rose-700">Cliquez sur le « ! » pour la cause et la solution.</span>
          </div>
        ) : null}

        {/* Logs */}
        {data.logs.length > 0 ? (
          <div className="mt-3">
            <button type="button" onClick={() => setShowDetails((v) => !v)} className="text-[12px] font-semibold" style={{ color: "var(--blue-600)" }}>
              {showDetails ? "Masquer les détails" : "Voir les détails"}
            </button>
            {showDetails ? (
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {data.logs.join("\n")}
              </pre>
            ) : null}
          </div>
        ) : null}

        {/* Pied */}
        <div className="mt-4 flex items-center justify-end gap-2">
          {showError && onRetry ? (
            <button type="button" onClick={onRetry} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--blue-600)" }}>
              <RefreshCw className="h-4 w-4" strokeWidth={2} /> Relancer
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            disabled={!terminal}
            className="inline-flex h-9 items-center rounded-lg border px-4 text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            {terminal ? "Fermer" : "En cours…"}
          </button>
        </div>
      </div>
    </div>
  );
}
