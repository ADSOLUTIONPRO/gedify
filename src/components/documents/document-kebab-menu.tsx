"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  Archive, Bot, Download, FolderPlus, Image as ImageIcon, Mail, MoreHorizontal, ScanText, Trash2,
} from "lucide-react";
import type { DocActionHandlers, DocumentVM } from "@/components/documents/types";

/* ────────────────────────────────────────────────────────────────────────
   Menu « … » d'actions par document, PARTAGÉ par les trois vues (grille,
   vignette, liste). Le panneau est rendu dans un PORTAIL vers <body> avec une
   position calculée depuis le bouton → il n'est jamais rogné par le
   `overflow-hidden` des cartes, et reste dans le viewport.

   Actions : Télécharger · Envoyer par mail · Ajouter à un dossier · Relancer
   l'OCR · Réanalyser avec l'IA · Régénérer miniature + aperçu · Archiver ·
   Supprimer. Tous les handlers proviennent du jeu d'actions document partagé.
   ──────────────────────────────────────────────────────────────────────── */
const itemClass = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition hover:bg-[var(--bg-card-soft)]";
const MENU_W = 236;
const EST_H = 340;

export function DocumentKebabMenu({
  doc,
  actions,
  archiveMode = "archive",
  className,
}: {
  doc: DocumentVM;
  actions: DocActionHandlers;
  archiveMode?: "archive" | "unarchive";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // Une position d'ancrage figée → fermer si on défile ou redimensionne.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  function toggle(e: ReactMouseEvent) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      let left = Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8);
      if (!Number.isFinite(left)) left = 8;
      // Ouvre au-dessus si le bas du viewport est trop proche.
      const top = r.bottom + EST_H > window.innerHeight ? Math.max(8, r.top - EST_H - 6) : r.bottom + 6;
      setPos({ top, left });
    }
    setOpen(true);
  }

  const act = (fn: (d: DocumentVM) => void) => (e: ReactMouseEvent) => { e.stopPropagation(); setOpen(false); fn(doc); };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Plus d'actions"
        aria-expanded={open}
        title="Plus d'actions"
        className={className ?? "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-card-soft)]"}
        style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </button>

      {mounted && open && pos
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[120]" onClick={(e) => { e.stopPropagation(); setOpen(false); }} aria-hidden="true" />
              <div
                className="fixed z-[121] rounded-xl border bg-white py-1.5 shadow-xl"
                style={{ top: pos.top, left: pos.left, width: MENU_W, borderColor: "var(--border)" }}
                onClick={(e) => e.stopPropagation()}
                role="menu"
              >
                <button type="button" role="menuitem" onClick={act(actions.onDownload)} className={itemClass} style={{ color: "var(--text-main)" }}>
                  <Download className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> Télécharger
                </button>
                <button type="button" role="menuitem" onClick={act(actions.onSendMail)} className={itemClass} style={{ color: "var(--text-main)" }}>
                  <Mail className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> Envoyer par mail
                </button>
                <button type="button" role="menuitem" onClick={act(actions.onAddToFolder)} className={itemClass} style={{ color: "var(--text-main)" }}>
                  <FolderPlus className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> Ajouter à un dossier
                </button>

                <div className="my-1 h-px" style={{ background: "var(--border-soft)" }} aria-hidden="true" />

                <button type="button" role="menuitem" onClick={act(actions.onRedoOcr)} className={itemClass} style={{ color: "var(--text-main)" }}>
                  <ScanText className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> Relancer l&apos;OCR
                </button>
                <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); actions.onAi(doc, "reanalyser"); }} className={itemClass} style={{ color: "var(--text-main)" }}>
                  <Bot className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> Réanalyser avec l&apos;IA
                </button>
                <button type="button" role="menuitem" onClick={act(actions.onRegenerateThumbnail)} className={itemClass} style={{ color: "var(--text-main)" }}>
                  <ImageIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> Régénérer miniature + aperçu
                </button>

                <div className="my-1 h-px" style={{ background: "var(--border-soft)" }} aria-hidden="true" />

                <button type="button" role="menuitem" onClick={act(actions.onArchive)} className={itemClass} style={{ color: "var(--text-main)" }}>
                  <Archive className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> {archiveMode === "unarchive" ? "Désarchiver" : "Archiver"}
                </button>
                <button type="button" role="menuitem" onClick={act(actions.onDelete)} className={itemClass} style={{ color: "#DC2626" }}>
                  <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> Supprimer
                </button>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
