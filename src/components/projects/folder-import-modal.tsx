"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FileText, FolderInput, Loader2, Upload, X } from "lucide-react";
import { ImportFileList } from "@/components/documents/import-file-list";
import { FOLDER_IMPORT_ACCEPT, useFolderUpload } from "@/lib/documents/use-folder-upload";

/**
 * Modale « Importer dans « Nom du dossier » ». Glisser-déposer + parcourir,
 * liste des fichiers (type/taille/validation/retrait), import multiple, suivi
 * du traitement de fond. Le classement dans le dossier est fait côté serveur
 * (champ folderId) — voir useFolderUpload.
 */
export function FolderImportModal({
  folderId,
  folderName,
  autoImportFiles,
  onClose,
}: {
  /** Si fourni → import classé dans ce dossier. Sinon → import général (GED). */
  folderId?: string;
  folderName?: string;
  /** Fichiers à importer IMMÉDIATEMENT à l'ouverture (glisser-déposer global). */
  autoImportFiles?: File[];
  onClose: () => void;
}) {
  const hasFolder = Boolean(folderId);
  const title = hasFolder ? `Importer dans « ${folderName} »` : "Importer des documents";
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // Monté côté client : permet le portail vers <body> (échappe au containing
  // block créé par le backdrop-filter de la topbar, qui « piégeait » le fixed).
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
  const { items, stageFiles, startUpload, uploadFiles, removeItem, uploading, pendingCount, hasResults } = useFolderUpload({ folderId });

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !uploading) onClose(); }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, uploading]);

  // Import direct des fichiers déposés (drag-and-drop global) dès l'ouverture.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !autoImportFiles || autoImportFiles.length === 0) return;
    autoStarted.current = true;
    void uploadFiles(autoImportFiles);
  }, [autoImportFiles, uploadFiles]);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) stageFiles(e.dataTransfer.files);
  }

  const successItems = items.filter((i) => i.status === "success");

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fermer" onClick={() => { if (!uploading) onClose(); }} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border-soft)" }}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <FolderInput className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15.5px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
                {hasFolder ? <>Importer dans «&nbsp;{folderName}&nbsp;»</> : "Importer des documents"}
              </h2>
              <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                {hasFolder
                  ? "Les documents importés seront automatiquement classés dans ce dossier."
                  : "Les documents importés sont ajoutés à votre GED, puis analysés automatiquement (OCR, indexation, IA)."}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => { if (!uploading) onClose(); }} aria-label="Fermer" disabled={uploading} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-[var(--surface-muted)] disabled:opacity-40" style={{ color: "var(--text-muted)" }}>
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Corps */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition"
            style={dragging
              ? { borderColor: "var(--accent)", background: "var(--accent-soft)" }
              : { borderColor: "var(--border-strong)", background: "var(--bg-card-soft)" }}
          >
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Upload className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Glissez vos fichiers ici</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>Tous formats : PDF, Word, Excel, PowerPoint, images, texte…</p>
            <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
              Parcourir les fichiers
            </button>
            <input ref={inputRef} type="file" multiple accept={FOLDER_IMPORT_ACCEPT} className="hidden" onChange={(e) => { if (e.target.files) stageFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {items.length > 0 ? (
            <div className="mt-4">
              <ImportFileList items={items} onRemove={removeItem} />
            </div>
          ) : null}

          {hasResults && !uploading ? (
            <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: "var(--gedify-green-soft)", background: "var(--gedify-green-soft)" }}>
              <p className="text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
                Import terminé — le traitement (OCR, indexation, IA) se poursuit en arrière-plan.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {successItems.length === 1 && typeof successItems[0].documentId === "number" ? (
                  <Link href={`/documents/${successItems[0].documentId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Ouvrir le document
                  </Link>
                ) : null}
                {hasFolder ? (
                  <Link href={`/dossiers/${folderId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                    <FolderInput className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Voir dans le dossier
                  </Link>
                ) : (
                  <Link href="/documents" className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Voir mes documents
                  </Link>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Pied */}
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3.5" style={{ borderColor: "var(--border-soft)" }}>
          <button type="button" onClick={() => { if (!uploading) onClose(); }} disabled={uploading} className="inline-flex h-10 items-center rounded-xl border px-4 text-[13.5px] font-semibold transition hover:bg-[var(--surface-muted)] disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            {hasResults ? "Fermer" : "Annuler"}
          </button>
          <button type="button" onClick={() => void startUpload()} disabled={uploading || pendingCount === 0} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
            {uploading ? "Import en cours…" : pendingCount > 0 ? `Importer ${pendingCount} fichier${pendingCount > 1 ? "s" : ""}` : "Importer"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
