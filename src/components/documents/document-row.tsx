"use client";

import { CalendarClock, FileSearch, Loader2, Sparkles } from "lucide-react";
import { BadgeTag } from "@/components/ui/badge-tag";
import { StatusPill } from "@/components/ui/status-pill";
import { STATUS_META, formatAmount, type DocumentVM } from "@/components/documents/types";
import { DocumentStatusBadges } from "@/components/documents/document-status-badges";
import { DocumentActionMenu, type DocActionHandlers } from "@/components/documents/document-action-menu";
import { DocumentFavoriteStar } from "@/components/documents/document-favorite-star";
import { DocumentPinButton } from "@/components/documents/document-pin-button";
import { DocumentHoverPreview } from "@/components/documents/document-hover-preview";

type DocumentRowProps = {
  doc: DocumentVM;
  checked: boolean;
  active: boolean;
  onToggle: (id: number, shift?: boolean) => void;
  onActivate: (id: number) => void;
  actions: DocActionHandlers;
  aiBusy: boolean;
};

/**
 * Ligne de document (vue Liste). Affiche checkbox, miniature, titre, correspondant,
 * type, date, nom de fichier, tags, statut, badges OCR/IA et les MÊMES actions que
 * la carte (Analyse IA, Fiche Doc, menu « … » complet). Cliquer la ligne ouvre l'aperçu.
 */
export function DocumentRow({ doc, checked, active, onToggle, onActivate, actions, aiBusy }: DocumentRowProps) {
  const status = STATUS_META[doc.status];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onActivate(doc.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate(doc.id);
        }
      }}
      aria-pressed={active}
      className="group grid cursor-pointer grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0"
      style={{
        borderColor: "var(--border-soft)",
        background: active ? "var(--accent-soft)" : undefined,
        boxShadow: active ? "inset 3px 0 0 var(--accent)" : undefined,
      }}
    >
      {/* Checkbox (sélection groupée) */}
      <label className="flex items-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onClick={(e) => { e.stopPropagation(); onToggle(doc.id, e.shiftKey); }}
          onChange={() => {}}
          aria-label={`Sélectionner ${doc.displayTitle}`}
          className="h-4 w-4 rounded border-slate-300 accent-[var(--accent)]"
        />
      </label>

      {/* Épingle + favori */}
      <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <DocumentPinButton documentId={doc.id} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition hover:bg-[var(--bg-card-soft)]" />
        <DocumentFavoriteStar documentId={doc.id} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition hover:bg-[var(--bg-card-soft)]" />
      </span>

      {/* Miniature (aperçu moyen au survol) */}
      <DocumentHoverPreview documentId={doc.id} title={doc.displayTitle} className="flex h-12 w-10 items-center justify-center overflow-hidden bg-[#F4F0E8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={doc.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
      </DocumentHoverPreview>

      {/* Titre + métadonnées */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-bold" style={{ color: "var(--gedify-navy)" }} title={doc.displayTitle}>
            {doc.displayTitle}
          </span>
          {doc.amount ? (
            <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--gedify-green-soft)", color: "#15803D" }}>
              {formatAmount(doc.amount.amount, doc.amount.currency)}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          {doc.subtitle ? <span className="truncate font-medium">{doc.subtitle}</span> : null}
          <span>·</span>
          <span>{doc.dateLabel}</span>
          {doc.due ? (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1" style={{ color: "var(--orange)" }}>
                <CalendarClock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                {doc.due.formatted}
              </span>
            </>
          ) : null}
          {doc.fileName && doc.fileName !== doc.displayTitle ? (
            <span className="truncate text-[11px] opacity-70" title={doc.fileName}>
              — {doc.fileName}
            </span>
          ) : null}
        </div>
        <DocumentStatusBadges statuses={doc.statuses} busy={aiBusy} className="mt-1" onRetryAi={() => actions.onAi(doc, "analyse")} />
        {doc.tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {doc.tags.slice(0, 3).map((tag) => (
              <BadgeTag key={tag.name} tag={tag} compact />
            ))}
            {doc.tags.length > 3 ? (
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                +{doc.tags.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Statut + actions (mêmes options que la carte) */}
      <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <StatusPill tone={status.tone} dot>
          {status.label}
        </StatusPill>

        {/* Analyse IA : icône (md), icône + label (lg+) */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); actions.onAi(doc, "analyse"); }}
          disabled={aiBusy}
          title="Analyse IA"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
          <span className="hidden lg:inline">Analyse IA</span>
        </button>

        {/* Fiche Doc : lg+ uniquement */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); actions.onFicheIA(doc); }}
          title="Fiche Doc"
          className="hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-bold transition hover:bg-[var(--bg-card-soft)] lg:inline-flex"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-main)" }}
        >
          <FileSearch className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden="true" /> Fiche Doc
        </button>

        <DocumentActionMenu doc={doc} actions={actions} aiBusy={aiBusy} />
      </div>
    </div>
  );
}
