"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelRightClose, PanelRightOpen, X } from "lucide-react";

type ResponsiveDetailPanelProps = {
  children: ReactNode;
  title?: string;
  /** Largeur du panneau sur grand écran. */
  width?: number;
  /** Étire le panneau sur toute la hauteur utile (scroll interne). */
  fill?: boolean;
};

/**
 * Panneau de détail responsive (cf. brief) :
 * - Grand écran (≥ xl) : colonne fixe à droite, intégrée au flux.
 * - Tablette / mobile (< xl) : drawer déclenché par un bouton flottant.
 */
export function ResponsiveDetailPanel({
  children,
  title = "Détail",
  width = 340,
  fill = false,
}: ResponsiveDetailPanelProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      {/* Inline (xl+) */}
      <aside
        className="hidden shrink-0 xl:block"
        style={{ width }}
        aria-label={title}
      >
        <div
          className="sticky top-[88px] rounded-2xl border bg-white"
          style={{
            borderColor: "var(--border)",
            boxShadow: "0 1px 2px rgba(8,18,37,0.04)",
            ...(fill ? { maxHeight: "calc(100dvh - 104px)", overflowY: "auto" } : { overflow: "hidden" }),
          }}
        >
          {children}
        </div>
      </aside>

      {/* Bouton d'ouverture (< xl) — empilé AU-DESSUS du bouton Assistant IA
          (fixé en bas-droite) pour ne jamais le recouvrir, sur toute
          résolution < xl. z au-dessus de l'assistant en cas de contact. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[150px] z-[81] inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 md:right-6 md:bottom-[90px] xl:hidden"
        style={{ background: "var(--blue-600)" }}
      >
        <PanelRightOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        {title}
      </button>

      {/* Drawer (< xl) */}
      {open ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label={title}>
          <button
            type="button"
            aria-label="Fermer le panneau"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
          />
          <aside
            className="absolute inset-y-0 right-0 flex w-[360px] max-w-[90vw] flex-col bg-white shadow-2xl"
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                <PanelRightClose className="h-4 w-4 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
                {title}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
