"use client";

import { useEffect, useRef } from "react";
import { Loader2, TriangleAlert, X } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  /** Variante du bouton de confirmation (défaut: danger rouge). */
  variant?: "danger" | "warning";
};

/**
 * Dialogue de confirmation de suppression/retrait.
 * Jamais de suppression sans passer ici.
 */
export function ConfirmDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Supprimer",
  cancelLabel = "Annuler",
  loading = false,
  variant = "danger",
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const confirmStyle =
    variant === "danger"
      ? { background: "#DC2626", color: "#fff" }
      : { background: "#D97706", color: "#fff" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="cdialog-title">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Carte */}
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100"
          style={{ color: "var(--text-muted)" }}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: variant === "danger" ? "#FEE2E2" : "#FEF3C7", color: variant === "danger" ? "#DC2626" : "#D97706" }}
            aria-hidden="true"
          >
            <TriangleAlert className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 id="cdialog-title" className="text-[15px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--text-muted)" }}>
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-9 items-center rounded-xl border px-4 text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold transition hover:opacity-90 disabled:opacity-50"
            style={confirmStyle}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
