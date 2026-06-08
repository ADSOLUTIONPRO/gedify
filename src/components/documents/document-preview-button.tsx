"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download, ExternalLink, Eye, X } from "lucide-react";

/**
 * Déclencheur + MODALE d'aperçu plein document (iframe sur la route preview).
 * Reste sur la page courante (ex. fiche IA) → permet de vérifier le document
 * pendant l'édition des suggestions, sans naviguer ailleurs. Échap / clic fond
 * pour fermer. Si `children` est fourni, il sert de déclencheur (ex. la
 * miniature) ; sinon un bouton « Aperçu du document » par défaut.
 */
export function DocumentPreviewButton({
  documentId,
  title,
  triggerClassName,
  children,
}: {
  documentId: number | string;
  title?: string;
  triggerClassName?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const previewUrl = `/api/paperless/documents/${documentId}/preview`;
  const downloadUrl = `/api/paperless/documents/${documentId}/download`;
  const label = title || `Document ${documentId}`;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Aperçu de ${label}`}
        className={triggerClassName ?? "inline-flex h-9 items-center gap-2 rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-slate-50"}
        style={triggerClassName ? undefined : { borderColor: "var(--border)", color: "var(--text-main)" }}
      >
        {children ?? (<><Eye className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> Aperçu du document</>)}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={`Aperçu — ${label}`}>
          <button type="button" aria-label="Fermer l'aperçu" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate text-[14px] font-bold text-white" title={label}>{label}</span>
              <div className="flex items-center gap-1.5">
                <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[20px] border border-white/30 px-3 text-[12.5px] font-bold text-white transition hover:bg-white/15">
                  <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> <span className="hidden sm:inline">Ouvrir</span>
                </a>
                <a href={downloadUrl} className="inline-flex h-9 items-center gap-1.5 rounded-[20px] border border-white/30 px-3 text-[12.5px] font-bold text-white transition hover:bg-white/15">
                  <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> <span className="hidden sm:inline">Télécharger</span>
                </a>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15">
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>
            <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 px-4 pb-5">
              <div className="w-full overflow-hidden rounded-xl bg-white shadow-2xl">
                <iframe title={`Aperçu — ${label}`} src={previewUrl} className="h-full w-full" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
