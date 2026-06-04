"use client";

import { useState } from "react";
import { Download, ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type Props = {
  documentId: number;
  documentTitle: string;
  mimeType?: string | null;
  onDeleted?: () => void;
};

const PREVIEWABLE = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/bmp",
  "text/plain",
];

function isPreviewable(mimeType?: string | null) {
  if (!mimeType) return false;
  return PREVIEWABLE.some((t) => mimeType.startsWith(t));
}

export function DocumentViewer({ documentId, documentTitle, mimeType, onDeleted }: Props) {
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regen, setRegen] = useState<"idle" | "running" | "done">("idle");

  const previewUrl = `/api/paperless/documents/${documentId}/preview`;
  const downloadUrl = `/api/paperless/documents/${documentId}/download`;
  const canPreview = isPreviewable(mimeType);

  async function regenerate() {
    setRegen("running");
    try {
      await Promise.all([
        fetch(`/api/documents/${documentId}/regenerate-thumbnail`, { method: "POST", credentials: "include" }).catch(() => {}),
        fetch(`/api/documents/${documentId}/regenerate-preview`, { method: "POST", credentials: "include" }).catch(() => {}),
      ]);
      setRegen("done");
      setTimeout(() => setRegen("idle"), 4000);
    } catch {
      setRegen("idle");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/paperless/documents/${documentId}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmDelete(false);
        onDeleted?.();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold transition hover:bg-slate-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Ouvrir
          </a>
          <a
            href={downloadUrl}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Télécharger
          </a>
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={regen === "running"}
            title="Régénère la miniature et l'aperçu en arrière-plan"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-xs font-semibold transition hover:bg-slate-50 disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            {regen === "running" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            )}
            {regen === "done" ? "Régénération lancée ✓" : "Régénérer l'aperçu"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition hover:bg-red-50"
          style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Mettre à la corbeille
        </button>
      </div>

      {canPreview ? (
        <div
          className="relative overflow-hidden rounded-xl"
          style={{ height: 680, background: "var(--bg-page)" }}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : null}
          <iframe
            title={`Aperçu — ${documentTitle}`}
            src={previewUrl}
            className="h-full w-full"
            onLoad={() => setLoading(false)}
          />
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>
            Aperçu non disponible pour ce type de fichier
            {mimeType ? (
              <span className="ml-1 font-normal opacity-70">({mimeType})</span>
            ) : null}
          </p>
          <a
            href={downloadUrl}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            <Download className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Télécharger le fichier
          </a>
        </div>
      )}

      <ConfirmActionDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        variant="delete"
        title="Mettre ce document à la corbeille ?"
        description="Le document sera supprimé du moteur local. Cette action est irréversible."
        confirmLabel="Mettre à la corbeille"
        loading={deleting}
      />
    </div>
  );
}
