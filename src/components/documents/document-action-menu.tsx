"use client";

import { useState } from "react";
import {
  Archive, Cpu, Download, Eye, FileSearch, FolderPlus, Mail, MoreHorizontal, Pencil,
  RefreshCw, ShieldCheck, Sparkles, Trash2, Wand2, Zap,
} from "lucide-react";
import { SignDocumentButton } from "@/components/documents/sign-document-button";
import type { DocumentVM } from "@/components/documents/types";
import type { AiActionId } from "@/lib/documents/document-ai";

/**
 * Jeu d'actions document partagé par la carte (grille), la ligne (liste) et la
 * sidebar d'aperçu. Source unique : ajouter une action ici la rend disponible
 * partout. Aucune logique métier — uniquement des callbacks fournis par le parent.
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

function MenuItem({ icon: Icon, label, onClick, color, danger }: { icon: typeof Zap; label: string; onClick: () => void; color?: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-semibold transition hover:bg-[var(--bg-card-soft)]"
      style={{ color: danger ? "#DC2626" : "var(--text-main)" }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} style={{ color: danger ? "#DC2626" : color ?? "var(--text-muted)" }} aria-hidden="true" /> {label}
    </button>
  );
}

const Divider = () => <div className="my-1 border-t" style={{ borderColor: "var(--border-soft)" }} />;

/**
 * Bouton « … » + menu déroulant complet d'un document.
 * `dropUp` : ouvre le menu vers le haut (utile en bas d'une carte).
 */
export function DocumentActionMenu({
  doc,
  actions,
  aiBusy,
  dropUp = false,
}: {
  doc: DocumentVM;
  actions: DocActionHandlers;
  aiBusy?: boolean;
  dropUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isPdf = (doc.mimeType ?? "").toLowerCase().includes("pdf");
  const close = () => setOpen(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="Actions du document"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-card-soft)]"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); close(); }} aria-hidden="true" />
          <div
            className={`absolute right-0 z-50 max-h-[70vh] w-56 overflow-y-auto rounded-xl border bg-white py-1 shadow-xl ${dropUp ? "bottom-9" : "top-9"}`}
            style={{ borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem icon={Eye} label="Voir le document" onClick={() => { close(); actions.onView(doc); }} />
            <Divider />
            {AI_VARIANTS.map((a) => (
              <MenuItem key={a.id} icon={aiBusy ? RefreshCw : a.icon} label={a.label} color={a.color} onClick={() => { close(); actions.onAi(doc, a.id); }} />
            ))}
            <MenuItem icon={FileSearch} label="Fiche IA" color="#7C3AED" onClick={() => { close(); actions.onFicheIA(doc); }} />
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
        </>
      ) : null}
    </div>
  );
}
