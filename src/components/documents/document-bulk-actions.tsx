"use client";

import { useRef, useState } from "react";
import {
  Archive,
  Bot,
  Download,
  Edit3,
  ExternalLink,
  FileSearch,
  FolderInput,
  FolderPlus,
  Mail,
  MoreHorizontal,
  ScanText,
  Trash2,
  X,
} from "lucide-react";

type DocumentBulkActionsProps = {
  count: number;
  onClear: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onAddToFolder: () => void;
  onSendByMail: () => void;
  onArchive: () => void;
  onReanalyze: () => void;
  onRedoOcr: () => void;
  onOpenFirst: () => void;
  onDelete: () => void;
  paperlessUrl: string | null;
  firstDocId: number | null;
};

const actionClass =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-semibold transition hover:bg-slate-50 whitespace-nowrap";

/**
 * Barre d'actions groupées avec menu déroulant réel.
 * Les actions principales sont toujours visibles.
 * Le menu ··· contient les actions secondaires — il ne redirige plus jamais.
 */
export function DocumentBulkActions({
  count,
  onClear,
  onDownload,
  onEdit,
  onAddToFolder,
  onSendByMail,
  onArchive,
  onReanalyze,
  onRedoOcr,
  onOpenFirst,
  onDelete,
  paperlessUrl,
  firstDocId,
}: DocumentBulkActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  if (count === 0) return null;

  const paperlessDocUrl =
    paperlessUrl && firstDocId ? `${paperlessUrl}/documents/${firstDocId}` : null;

  return (
    <div
      className="relative flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-2.5"
      style={{ borderColor: "var(--blue-600)", boxShadow: "0 1px 2px rgba(11,92,255,0.10)" }}
    >
      {/* Compteur + désélectionner */}
      <span className="inline-flex items-center gap-2 pl-1 pr-1 text-[12.5px] font-bold" style={{ color: "var(--blue-600)" }}>
        {count} sélectionné{count > 1 ? "s" : ""}
        <button
          type="button"
          onClick={onClear}
          aria-label="Tout désélectionner"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </span>

      <span className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} aria-hidden="true" />

      {/* Actions principales toujours visibles */}
      <button type="button" onClick={onDownload} className={actionClass} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
        <Download className="h-4 w-4" strokeWidth={1.75} />
        Télécharger
      </button>

      <button type="button" onClick={onEdit} className={actionClass} style={{ borderColor: "var(--blue-600)", color: "var(--blue-600)", background: "rgba(11,92,255,0.06)" }}>
        <Edit3 className="h-4 w-4" strokeWidth={1.75} />
        Modifier
      </button>

      <button type="button" onClick={onAddToFolder} className={actionClass} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
        <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
        Ajouter à un dossier
      </button>

      <button type="button" onClick={onSendByMail} className={actionClass} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
        <Mail className="h-4 w-4" strokeWidth={1.75} />
        Envoyer par mail
      </button>

      <button type="button" onClick={onReanalyze} className={actionClass} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
        <Bot className="h-4 w-4" strokeWidth={1.75} />
        Relancer IA
      </button>

      <button type="button" onClick={onArchive} className={actionClass} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
        <Archive className="h-4 w-4" strokeWidth={1.75} />
        Archiver
      </button>

      {/* Menu ··· */}
      <div ref={menuRef} className="relative ml-auto">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Plus d'actions"
          aria-expanded={menuOpen}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-slate-50"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              className="absolute right-0 top-10 z-30 w-60 rounded-xl border bg-white py-1.5 shadow-xl"
              style={{ borderColor: "var(--border)" }}
            >
              <p className="border-b px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                {count} document{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
              </p>

              {count === 1 && (
                <button
                  type="button"
                  onClick={() => { onOpenFirst(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-slate-50"
                  style={{ color: "var(--text-main)" }}
                >
                  <FileSearch className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  Voir le détail
                </button>
              )}

              {paperlessDocUrl && count === 1 && (
                <a
                  href={paperlessDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-slate-50"
                  style={{ color: "var(--text-main)" }}
                >
                  <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  Ouvrir le document
                </a>
              )}

              <button
                type="button"
                onClick={() => { onEdit(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-slate-50"
                style={{ color: "var(--text-main)" }}
              >
                <Edit3 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Modifier les métadonnées
              </button>

              <button
                type="button"
                onClick={() => { onAddToFolder(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-slate-50"
                style={{ color: "var(--text-main)" }}
              >
                <FolderPlus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Ajouter à un dossier
              </button>

              <button
                type="button"
                onClick={() => { onSendByMail(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-slate-50"
                style={{ color: "var(--text-main)" }}
              >
                <Mail className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Envoyer le(s) document(s) par mail
              </button>

              <button
                type="button"
                onClick={() => { onReanalyze(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-slate-50"
                style={{ color: "var(--text-main)" }}
              >
                <Bot className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Relancer l&apos;analyse IA
              </button>

              <button
                type="button"
                onClick={() => { onRedoOcr(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-slate-50"
                style={{ color: "var(--text-main)" }}
              >
                <ScanText className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Relancer l&apos;OCR
              </button>

              <button
                type="button"
                onClick={() => { onArchive(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-slate-50"
                style={{ color: "var(--text-main)" }}
              >
                <FolderInput className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Archiver
              </button>

              <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />

              <button
                type="button"
                onClick={() => { onDelete(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-rose-50"
                style={{ color: "#DC2626" }}
              >
                <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                Supprimer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
