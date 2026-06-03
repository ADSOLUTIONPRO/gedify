"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/**
 * Bottom sheet mobile : monte du bas, fond blanc, coins arrondis en haut,
 * poignée visuelle, bouton fermer, contenu scrollable. Overlay + Échap.
 */
export function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label={title ?? "Options"}>
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        {/* Poignée */}
        <div className="flex justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full" style={{ background: "var(--border)" }} aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2 className="text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="px-4 pb-2">{children}</div>
      </div>
    </div>
  );
}
