"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, RefreshCw, ExternalLink, X } from "lucide-react";
import { resolveError, guessErrorCode } from "@/lib/errors/error-catalog";

/* GedifyErrorHint — petit « ! » entouré, cliquable, qui ouvre un popover avec :
   détail de l'erreur, cause probable, solution, et un bouton « Relancer » si une
   action de relance est fournie. Réutilisable partout (cartes, fiches, jobs,
   Santé GED, mails, finances…).

   Le popover est PORTÉ dans document.body et positionné en `fixed` : il n'est
   donc jamais rogné par le cadre `overflow-hidden` d'une carte / vignette. */

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

const POP_W = 288; // w-72
const PAD = 12;

export function GedifyErrorHint({ code, message, onRetry, retryLabel, logsHref, size = "sm", label }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const resolvedCode = code ?? guessErrorCode(message);
  const entry = resolveError(resolvedCode);
  const dim = size === "md" ? "h-5 w-5" : "h-4 w-4";

  const place = () => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const ph = popRef.current?.offsetHeight ?? 220;
    let top = r.bottom + 8;
    if (top + ph > vh - PAD) top = Math.max(PAD, r.top - ph - 8);
    let left = r.right - POP_W;
    if (left < PAD) left = PAD;
    if (left + POP_W > vw - PAD) left = vw - PAD - POP_W;
    setPos({ top, left });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    function onScroll() { setOpen(false); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <div className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex cursor-pointer items-center gap-1 rounded-full text-rose-600 transition hover:text-rose-700"
        title={entry.title}
        aria-label={`Erreur : ${entry.title}`}
      >
        <AlertCircle className={dim} strokeWidth={2.25} />
        {label ? <span className="text-[11px] font-bold">{label}</span> : null}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <div className="fixed inset-0" style={{ zIndex: 999 }} onClick={(e) => { e.stopPropagation(); setOpen(false); }} aria-hidden="true" />
              <div
                ref={popRef}
                role="dialog"
                onClick={(e) => e.stopPropagation()}
                className="rounded-xl border bg-white p-3 text-left shadow-xl"
                style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: POP_W, zIndex: 1000, borderColor: "var(--border-strong)", visibility: pos ? "visible" : "hidden" }}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="text-[13px] font-extrabold text-rose-700">{entry.title}</span>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="cursor-pointer text-slate-400 hover:text-slate-700">
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
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white transition hover:opacity-90"
                        style={{ background: "var(--blue-600)" }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} /> {retryLabel ?? entry.retryLabel ?? "Réessayer"}
                      </button>
                    ) : null}
                    {logsHref ? (
                      <a href={logsHref} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border-strong)", color: "var(--text-main)" }}>
                        <ExternalLink className="h-3.5 w-3.5" /> Logs
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
