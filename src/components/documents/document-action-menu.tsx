"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Archive, Cpu, Download, Eye, FileSearch, FolderPlus, Mail, MoreHorizontal, Pencil,
  RefreshCw, ShieldCheck, Sparkles, Trash2, Wand2, Zap,
} from "lucide-react";
import { SignDocumentButton } from "@/components/documents/sign-document-button";
import type { DocumentVM } from "@/components/documents/types";
import type { AiActionId } from "@/lib/documents/document-ai";

/**
 * Jeu d'actions document partagé par la carte (grille), la ligne (liste) et la
 * sidebar d'aperçu. Source unique. Le menu est rendu dans un PORTAIL vers
 * document.body et positionné en `fixed` par rapport au bouton « … » : il n'est
 * donc jamais rogné par l'overflow/border-radius/transform de la vignette, et
 * gère la collision (flip haut/bas, décalage horizontal) pour rester visible.
 */
export type DocActionHandlers = {
  onView: (doc: DocumentVM) => void;
  onAi: (doc: DocumentVM, action: AiActionId) => void;
  onFicheIA: (doc: DocumentVM) => void;
  onEdit: (doc: DocumentVM) => void;
  onAddToFolder: (doc: DocumentVM) => void;
  onSendMail: (doc: DocumentVM) => void;
  onDownload: (doc: DocumentVM) => void;
  onArchive: (doc: DocumentVM) => void;
  onDelete: (doc: DocumentVM) => void;
};

const AI_VARIANTS: { id: AiActionId; label: string; icon: typeof Zap; color: string }[] = [
  { id: "rapide", label: "Analyse IA rapide", icon: Zap, color: "#2563EB" },
  { id: "avancee", label: "Analyse IA avancée", icon: Sparkles, color: "#7C3AED" },
  { id: "locale", label: "Analyse locale", icon: Cpu, color: "#475569" },
  { id: "reanalyser", label: "Ré-analyser", icon: RefreshCw, color: "#2563EB" },
  { id: "completer", label: "Compléter avec IA", icon: Wand2, color: "#8B5CF6" },
  { id: "valider", label: "Valider les infos", icon: ShieldCheck, color: "#15803D" },
];

const MENU_WIDTH = 280;
const PAD = 12;

function MenuItem({ icon: Icon, label, onClick, color, danger }: { icon: typeof Zap; label: string; onClick: () => void; color?: string; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-semibold outline-none transition hover:bg-[var(--bg-card-soft)] focus-visible:bg-[var(--bg-card-soft)]"
      style={{ color: danger ? "#DC2626" : "var(--text-main)" }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} style={{ color: danger ? "#DC2626" : color ?? "var(--text-muted)" }} aria-hidden="true" /> {label}
    </button>
  );
}

const Divider = () => <div className="my-1 border-t" style={{ borderColor: "var(--border-soft)" }} />;

export function DocumentActionMenu({
  doc,
  actions,
  aiBusy,
}: {
  doc: DocumentVM;
  actions: DocActionHandlers;
  aiBusy?: boolean;
  /** Conservé pour compat (le placement est désormais auto par collision). */
  dropUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isPdf = (doc.mimeType ?? "").toLowerCase().includes("pdf");

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
    triggerRef.current?.focus();
  }, []);

  // Positionnement avec collision (mesure réelle de la hauteur du menu).
  const place = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const mh = menuRef.current?.offsetHeight ?? 360;
    let top = r.bottom + 8;
    if (top + mh > vh - PAD) {
      const above = r.top - mh - 8;
      top = above >= PAD ? above : Math.max(PAD, vh - mh - PAD);
    }
    let left = r.right - MENU_WIDTH;
    if (left < PAD) left = PAD;
    if (left + MENU_WIDTH > vw - PAD) left = vw - PAD - MENU_WIDTH;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // Focus le premier élément à l'ouverture.
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    const onScroll = () => setOpen(false);
    const onResize = () => place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      if (items.length === 0) return;
      const idx = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown") { e.preventDefault(); items[(idx + 1 + items.length) % items.length]?.focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
      else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
      else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, place, close]);

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Actions du document"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-card-soft)]"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              {/* Capte les clics extérieurs (sous le menu). */}
              <div className="fixed inset-0" style={{ zIndex: 999 }} onClick={(e) => { e.stopPropagation(); close(); }} aria-hidden="true" />
              <div
                ref={menuRef}
                role="menu"
                aria-label={`Actions — ${doc.displayTitle}`}
                onClick={(e) => e.stopPropagation()}
                className="overflow-y-auto rounded-xl border bg-white py-1 shadow-xl"
                style={{
                  position: "fixed",
                  top: pos?.top ?? -9999,
                  left: pos?.left ?? -9999,
                  width: MENU_WIDTH,
                  maxWidth: "min(320px, calc(100vw - 24px))",
                  maxHeight: "min(70vh, 620px)",
                  zIndex: 1000,
                  visibility: pos ? "visible" : "hidden",
                  borderColor: "var(--border)",
                }}
              >
                <MenuItem icon={Eye} label="Voir le document" onClick={() => { close(); actions.onView(doc); }} />
                <Divider />
                {AI_VARIANTS.map((a) => (
                  <MenuItem key={a.id} icon={aiBusy ? RefreshCw : a.icon} label={a.label} color={a.color} onClick={() => { close(); actions.onAi(doc, a.id); }} />
                ))}
                <MenuItem icon={FileSearch} label="Fiche Doc" color="#7C3AED" onClick={() => { close(); actions.onFicheIA(doc); }} />
                <Divider />
                <MenuItem icon={Pencil} label="Modifier" onClick={() => { close(); actions.onEdit(doc); }} />
                {isPdf ? (
                  <SignDocumentButton documentId={doc.id} title={doc.displayTitle} mimeType={doc.mimeType} variant="menu" />
                ) : null}
                <MenuItem icon={FolderPlus} label="Ajouter à un dossier" onClick={() => { close(); actions.onAddToFolder(doc); }} />
                <MenuItem icon={Mail} label="Envoyer par mail" onClick={() => { close(); actions.onSendMail(doc); }} />
                <MenuItem icon={Download} label="Télécharger" onClick={() => { close(); actions.onDownload(doc); }} />
                <MenuItem icon={Archive} label="Archiver" onClick={() => { close(); actions.onArchive(doc); }} />
                <Divider />
                <MenuItem icon={Trash2} label="Supprimer" danger onClick={() => { close(); actions.onDelete(doc); }} />
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
