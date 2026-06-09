"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, FileSearch, Folder, Loader2, Search } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { STATUS_META, formatAmount, type DocumentVM } from "@/components/documents/types";
import { DocumentStatusBadges } from "@/components/documents/document-status-badges";
import { type DocActionHandlers } from "@/components/documents/document-action-menu";
import { DocumentFavoriteStar } from "@/components/documents/document-favorite-star";
import { DocumentHoverPreview } from "@/components/documents/document-hover-preview";
import { GedifyErrorHint } from "@/components/ui/gedify-error-hint";

type DocumentSpaceCardProps = {
  doc: DocumentVM;
  checked: boolean;
  active: boolean;
  onToggle: (id: number, shift?: boolean) => void;
  onActivate: (id: number) => void;
  /** Ouvre la Lightbox d'aperçu (clic loupe), distinct du clic carte (résumé). */
  onPreview: (doc: DocumentVM) => void;
  /** Jeu d'actions document partagé (menu « … » + analyse). */
  actions: DocActionHandlers;
  /** Une action IA est en cours pour ce document. */
  aiBusy: boolean;
};

/**
 * Carte document compacte (vue grille / mobile). Met en avant la miniature et
 * le titre métier, avec correspondant, type, date, tags et statut. Les actions
 * (analyse, fiche IA, menu complet) sont partagées avec la vue Liste.
 */
export function DocumentSpaceCard({ doc, checked, active, onToggle, onActivate, onPreview, actions, aiBusy }: DocumentSpaceCardProps) {
  const status = STATUS_META[doc.status];

  // Miniature en erreur (placeholder) : badge GedifyErrorHint + régénération locale.
  const [bust, setBust] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const thumbSrc = bust ? `${doc.thumbUrl}${doc.thumbUrl.includes("?") ? "&" : "?"}rb=${bust}` : doc.thumbUrl;
  async function retryThumbnail() {
    if (retrying) return;
    setRetrying(true);
    try {
      await fetch(`/api/documents/${doc.id}/regenerate-thumbnail`, { method: "POST", credentials: "include" });
      await new Promise((r) => setTimeout(r, 3500)); // laisse le job se terminer
      setBust(Date.now());
    } catch {
      /* l'erreur reste visible via le badge */
    } finally {
      setRetrying(false);
    }
  }

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
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[18px] bg-white transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        boxShadow: active ? "0 0 0 1.5px var(--accent), var(--shadow-card)" : "var(--shadow-card)",
      }}
    >
      <label className="absolute left-2 top-2 z-10 flex items-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          onClick={(e) => { e.stopPropagation(); onToggle(doc.id, e.shiftKey); }}
          onChange={() => {}}
          aria-label={`Sélectionner ${doc.displayTitle}`}
          className="h-4 w-4 rounded border-slate-300 bg-white/90 accent-[var(--accent)]"
        />
      </label>

      <div className="absolute right-2 top-2 z-20" onClick={(e) => e.stopPropagation()}>
        <DocumentFavoriteStar documentId={doc.id} />
      </div>

      <DocumentHoverPreview documentId={doc.id} title={doc.displayTitle} className="group/thumb relative flex h-32 items-center justify-center overflow-hidden bg-[#F4F0E8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbSrc} alt="" loading="lazy" className="h-full w-full object-cover object-top" />

        {/* Miniature non rendue (placeholder) → cause + « Régénérer » */}
        {doc.statuses.thumbnailError ? (
          <div className="absolute right-2 top-2 z-20" onClick={(e) => e.stopPropagation()}>
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
            ) : (
              <GedifyErrorHint
                code={doc.statuses.thumbnailError}
                label="Vignette"
                onRetry={() => void retryThumbnail()}
                retryLabel="Régénérer"
              />
            )}
          </div>
        ) : null}
        {/* Overlay + loupe : ouvre la Lightbox (et non la sidebar résumé) */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPreview(doc); }}
          aria-label="Agrandir l'aperçu"
          title="Agrandir l'aperçu"
          className="absolute inset-0 flex cursor-zoom-in items-center justify-center opacity-0 transition group-hover/thumb:opacity-100"
          style={{ background: "rgba(15,23,42,0.30)" }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md">
            <Search className="h-4 w-4" style={{ color: "var(--text-main)" }} strokeWidth={2.25} aria-hidden="true" />
          </span>
        </button>
      </DocumentHoverPreview>

      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        {/* Dossier / type + date */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: "var(--bg-card-soft)", color: "var(--text-muted)" }}>
            <Folder className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="truncate">{doc.typeName ?? doc.tags[0]?.name ?? "Non classé"}</span>
          </span>
          <span className="shrink-0 text-[11px]" style={{ color: "var(--text-hint)" }}>{doc.dateLabel}</span>
        </div>

        {/* Titre + nom de fichier */}
        <span className="mt-1.5 truncate text-[14px] font-bold" style={{ color: "var(--gedify-navy)" }} title={doc.displayTitle}>
          {doc.displayTitle}
        </span>
        {doc.fileName ? (
          <span className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--text-muted)" }} title={doc.fileName}>
            {doc.fileName}
          </span>
        ) : null}

        {/* Tags (chips colorés) */}
        {doc.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {doc.tags.slice(0, 4).map((t, i) => (
              <span
                key={t.id ?? i}
                className="inline-flex max-w-[130px] items-center truncate rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                style={{
                  background: t.color ?? "#EEF2F7",
                  color: t.color ? (t.text_color ?? "#ffffff") : "#475569",
                }}
                title={t.name}
              >
                {t.name}
              </span>
            ))}
            {doc.tags.length > 4 ? (
              <span className="text-[10.5px] font-semibold" style={{ color: "var(--text-muted)" }}>
                +{doc.tags.length - 4}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Statut + badges OCR / IA */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <StatusPill tone={status.tone} dot>
            {status.label}
          </StatusPill>
          <DocumentStatusBadges statuses={doc.statuses} busy={aiBusy} onRetryAi={() => actions.onAi(doc, "analyse")} />
        </div>

        {/* Confiance + montant */}
        <div className="mt-2 flex items-center justify-between gap-2">
          {doc.statuses.confidencePct != null ? (
            <span className="text-[11.5px] font-medium" style={{ color: "var(--text-muted)" }}>
              Confiance : <span style={{ color: "var(--text-main)", fontWeight: 700 }}>{doc.statuses.confidencePct} %</span>
            </span>
          ) : (
            <span />
          )}
          {doc.amount ? (
            <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--gedify-green-soft)", color: "#15803D" }}>
              {formatAmount(doc.amount.amount, doc.amount.currency)}
            </span>
          ) : null}
        </div>

        {/* Actions vignette : Ouvrir (page document) + Fiche Doc. Les actions
            secondaires individuelles sont centralisées dans la Fiche Doc. */}
        <div className="mt-3 grid grid-cols-2 gap-1.5 pt-3" style={{ borderTop: "1px solid var(--border-soft)" }} onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/documents/${doc.id}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Ouvrir le document ${doc.displayTitle}`}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-white transition hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="truncate">Ouvrir</span>
          </Link>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); actions.onFicheIA(doc); }}
            aria-label="Fiche Doc"
            title="Fiche Doc"
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition hover:bg-[var(--bg-card-soft)]"
            style={{ background: "var(--surface)", color: "var(--text-main)", borderColor: "var(--border-strong)" }}
          >
            <FileSearch className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden="true" />
            <span className="truncate">Fiche Doc</span>
          </button>
        </div>
      </div>
    </div>
  );
}
