"use client";

import { ScanLine, Sparkles } from "lucide-react";

/* Modale partagée « OCR absent » / « OCR en cours » : utilisée par TOUS les
   boutons d'analyse IA de l'app pour ne jamais bloquer l'analyse faute d'OCR.
   - absent/insuffisant → « Lancer l'OCR » | « Oui, lancer l'analyse IA »
   - en cours (pending)  → « Attendre l'OCR » | « Lancer maintenant »            */
export function OcrAbsentModal({
  open,
  ocrStatus,
  onLaunchOcr,
  onAnalyzeAnyway,
  onClose,
}: {
  open: boolean;
  ocrStatus?: "done" | "low" | "pending";
  onLaunchOcr: () => void;
  onAnalyzeAnyway: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const pending = ocrStatus === "pending";
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={pending ? "OCR en cours" : "OCR absent"}>
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-3xl p-5 shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {pending ? (
          <>
            <h2 className="text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>OCR en cours</h2>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              L&apos;OCR de ce document n&apos;est pas encore terminé. Vous pouvez attendre la fin de l&apos;OCR, ou lancer l&apos;analyse IA maintenant (directement sur le document).
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13.5px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
                Attendre l&apos;OCR
              </button>
              <button type="button" onClick={onAnalyzeAnyway} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-[13.5px] font-bold transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" /> Lancer maintenant
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>OCR absent</h2>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Ce document ne dispose pas encore de texte OCR exploitable. L&apos;analyse IA peut tout de même examiner directement le document, mais certains résultats peuvent être moins précis selon le format et la qualité des pages.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={onLaunchOcr} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13.5px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
                <ScanLine className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" /> Lancer l&apos;OCR
              </button>
              <button type="button" onClick={onAnalyzeAnyway} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-[13.5px] font-bold transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" /> Oui, lancer l&apos;analyse IA
              </button>
            </div>
          </>
        )}
        <button type="button" onClick={onClose} className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-[13px] font-semibold transition hover:bg-[var(--bg-card-soft)]" style={{ color: "var(--text-muted)" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
