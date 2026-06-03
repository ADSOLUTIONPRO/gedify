"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Link2Off, Loader2, TriangleAlert, Trash2, X, XCircle } from "lucide-react";

export type ConfirmActionVariant = "delete" | "archive" | "reject" | "unlink" | "warning";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmActionVariant;
  requireTextConfirmation?: boolean;
  loading?: boolean;
};

const VARIANT_CONFIG: Record<
  ConfirmActionVariant,
  { icon: React.ElementType; iconBg: string; iconColor: string; btnBg: string; defaultLabel: string }
> = {
  delete: {
    icon: Trash2,
    iconBg: "#FEE2E2",
    iconColor: "#DC2626",
    btnBg: "#DC2626",
    defaultLabel: "Supprimer",
  },
  archive: {
    icon: Archive,
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    btnBg: "#D97706",
    defaultLabel: "Archiver",
  },
  reject: {
    icon: XCircle,
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    btnBg: "#D97706",
    defaultLabel: "Rejeter",
  },
  unlink: {
    icon: Link2Off,
    iconBg: "#EFF6FF",
    iconColor: "#3B82F6",
    btnBg: "#3B82F6",
    defaultLabel: "Dissocier",
  },
  warning: {
    icon: TriangleAlert,
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    btnBg: "#D97706",
    defaultLabel: "Confirmer",
  },
};

export function ConfirmActionDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  confirmLabel,
  cancelLabel = "Annuler",
  variant = "delete",
  requireTextConfirmation = false,
  loading = false,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState("");

  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;
  const label = confirmLabel ?? cfg.defaultLabel;
  const confirmText = itemName ?? "CONFIRMER";
  const canConfirm = !requireTextConfirmation || typed.trim() === confirmText;

  function handleClose() {
    setTyped("");
    onClose();
  }

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="caction-title"
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />

      <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100"
          style={{ color: "var(--text-muted)" }}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: cfg.iconBg, color: cfg.iconColor }}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2
              id="caction-title"
              className="text-[15px] font-extrabold tracking-tight"
              style={{ color: "var(--text-main)" }}
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--text-muted)" }}>
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {requireTextConfirmation ? (
          <div className="mt-4">
            <p className="mb-1.5 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
              Tapez{" "}
              <span className="rounded px-1 font-mono text-[11px]" style={{ background: "#F1F5F9", color: "var(--text-main)" }}>
                {confirmText}
              </span>{" "}
              pour confirmer
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:ring-2"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-main)",
                background: "var(--surface)",
              }}
              placeholder={confirmText}
              autoComplete="off"
            />
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="inline-flex h-9 items-center rounded-xl border px-4 text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !canConfirm}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: cfg.btnBg }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
