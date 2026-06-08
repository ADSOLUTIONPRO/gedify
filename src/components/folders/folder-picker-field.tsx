"use client";

import { useState } from "react";
import { Folder, FolderSearch, X } from "lucide-react";
import { FolderPickerModal, type FolderSelection } from "./folder-picker-modal";

/**
 * Champ « Dossier sélectionné [Parcourir…] » qui ouvre l'explorateur visuel.
 * Conserve l'identifiant réel du dossier (FolderSelection.id), affiche le
 * chemin complet, permet de retirer la sélection. Réutilisable partout.
 */
export function FolderPickerField({
  value,
  onChange,
  allowCreate = true,
  disabled = false,
}: {
  value: FolderSelection | null;
  onChange: (value: FolderSelection | null) => void;
  allowCreate?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: value ? "var(--accent-soft)" : "var(--surface)" }}>
          <Folder className="h-4 w-4 shrink-0" strokeWidth={1.85} style={{ color: value ? "var(--accent)" : "var(--text-hint)" }} aria-hidden="true" />
          {value ? (
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }} title={value.path}>{value.path}</span>
          ) : (
            <span className="flex-1 text-[13px]" style={{ color: "var(--text-muted)" }}>Aucun dossier sélectionné</span>
          )}
          {value && !disabled ? (
            <button type="button" onClick={() => onChange(null)} aria-label="Retirer le dossier" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition hover:bg-white" style={{ color: "var(--text-muted)" }}>
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border bg-white px-3 text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          <FolderSearch className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> Parcourir…
        </button>
      </div>

      {open ? (
        <FolderPickerModal
          currentValue={value}
          allowCreate={allowCreate}
          onSelect={(v) => { onChange(v); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
