"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw, ExternalLink, X } from "lucide-react";
import { resolveError, guessErrorCode } from "@/lib/errors/error-catalog";

/* GedifyErrorHint — petit « ! » entouré, cliquable, qui ouvre un popover avec :
   détail de l'erreur, cause probable, solution, et un bouton « Relancer » si une
   action de relance est fournie. Réutilisable partout (cartes, fiches, jobs,
   Santé GED, mails, finances…). */

type Props = {
  /** Code catalogue (sinon déduit du message). */
  code?: string | null;
  /** Message brut éventuel (affiché en détail technique). */
  message?: string | null;
  /** Action de relance. Si fournie, un bouton « Relancer » apparaît. */
  onRetry?: () => void;
  /** Override du libellé de relance. */
  retryLabel?: string;
  /** Lien vers les logs, si disponible. */
  logsHref?: string;
  size?: "sm" | "md";
  /** Libellé optionnel affiché à côté du « ! » (ex. « OCR erreur »). */
  label?: string;
};

export function GedifyErrorHint({ code, message, onRetry, retryLabel, logsHref, size = "sm", label }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const resolvedCode = code ?? guessErrorCode(message);
  const entry = resolveError(resolvedCode);
  const dim = size === "md" ? "h-5 w-5" : "h-4 w-4";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center gap-1 rounded-full text-rose-600 transition hover:text-rose-700"
        title={entry.title}
        aria-label={`Erreur : ${entry.title}`}
      >
        <AlertCircle className={dim} strokeWidth={2.25} />
        {label ? <span className="text-[11px] font-bold">{label}</span> : null}
      </button>

      {open ? (
        <div
          role="dialog"
          className="absolute right-0 top-[120%] z-50 w-72 rounded-xl border bg-white p-3 text-left shadow-xl"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <span className="text-[13px] font-extrabold text-rose-700">{entry.title}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="text-slate-400 hover:text-slate-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[12px]" style={{ color: "var(--text-main)" }}>
            <strong>Cause probable :</strong> {entry.cause}
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-main)" }}>
            <strong>Solution :</strong> {entry.solution}
          </p>
          {message ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                Détail technique
              </summary>
              <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {message}
              </pre>
            </details>
          ) : null}
          {(onRetry || logsHref) ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {onRetry ? (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onRetry(); }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white transition hover:opacity-90"
                  style={{ background: "var(--blue-600)" }}
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} /> {retryLabel ?? entry.retryLabel ?? "Réessayer"}
                </button>
              ) : null}
              {logsHref ? (
                <a href={logsHref} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                  <ExternalLink className="h-3.5 w-3.5" /> Logs
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
