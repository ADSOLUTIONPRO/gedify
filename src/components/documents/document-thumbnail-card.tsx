"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, FolderOpen, Loader2, Search, Shapes, Users } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { STATUS_META, type DocumentVM } from "@/components/documents/types";
import { DocumentStatusBadges } from "@/components/documents/document-status-badges";
import { DocumentActionMenu, type DocActionHandlers } from "@/components/documents/document-action-menu";
import { DocumentFavoriteStar } from "@/components/documents/document-favorite-star";
import { DocumentHoverPreview } from "@/components/documents/document-hover-preview";
import { GedifyErrorHint } from "@/components/ui/gedify-error-hint";

type DocumentThumbnailCardProps = {
  doc: DocumentVM;
  checked: boolean;
  active: boolean;
  onToggle: (id: number, shift?: boolean) => void;
  onActivate: (id: number) => void;
  onPreview: (doc: DocumentVM) => void;
  actions: DocActionHandlers;
  aiBusy: boolean;
};

/**
 * Carte document HORIZONTALE compacte (vue « Vignette ») : miniature à gauche,
 * informations (titre, fichier, date, correspondant, type, statut, tags) à
 * droite, et actions Ouvrir / Fiche Doc / menu « … » en bas. Mêmes données,
 * mêmes handlers et mêmes actions que les vues Grille et Liste (aucune logique
 * métier dupliquée — uniquement un rendu différent).
 */
export function DocumentThumbnailCard({ doc, checked, active, onToggle, onActivate, onPreview, actions, aiBusy }: DocumentThumbnailCardProps) {
  const status = STATUS_META[doc.status];

  const [bust, setBust] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const thumbSrc = bust ? `${doc.thumbUrl}${doc.thumbUrl.includes("?") ? "&" : "?"}rb=${bust}` : doc.thumbUrl;
  async function retryThumbnail() {
    if (retrying) return;
    setRetrying(true);
    try {
      await fetch(`/api/documents/${doc.id}/regenerate-thumbnail`, { method: "POST", credentials: "include" });
      await new Promise((r) => setTimeout(r, 3500));
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
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate(doc.id); }
      }}
      aria-pressed={active}
      className="group relative flex cursor-pointer gap-3 overflow-hidden rounded-[18px] p-2.5 transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        // Carte sélectionnée (case cochée) : bordure rose + fond rose très léger.
        // Carte active (panneau Détail) : simple anneau rose. La case cochée reste
        // l'indice non-coloré complémentaire.
        background: checked ? "var(--accent-soft)" : "var(--surface)",
        boxShadow: checked || active ? "0 0 0 1.5px var(--accent), var(--shadow-card)" : "var(--shadow-card)",
      }}
    >
      {/* Miniature à gauche (aperçu moyen au survol) */}
      <DocumentHoverPreview documentId={doc.id} title={doc.displayTitle} className="group/thumb relative h-[116px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-[#F4F0E8]">
        <label className="absolute left-1.5 top-1.5 z-10 flex items-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={checked}
            onClick={(e) => { e.stopPropagation(); onToggle(doc.id, e.shiftKey); }}
            onChange={() => {}}
            aria-label={`Sélectionner ${doc.displayTitle}`}
            className="h-4 w-4 rounded border-slate-300 bg-white/90 accent-[var(--accent)]"
          />
        </label>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbSrc} alt="" loading="lazy" className="h-full w-full object-cover object-top" />

        {doc.statuses.thumbnailError ? (
          <div className="absolute right-1.5 top-1.5 z-20" onClick={(e) => e.stopPropagation()}>
            {retrying ? (
              <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
            ) : (
              <GedifyErrorHint code={doc.statuses.thumbnailError} label="Vignette" onRetry={() => void retryThumbnail()} retryLabel="Régénérer" />
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPreview(doc); }}
          aria-label="Agrandir l'aperçu"
          title="Agrandir l'aperçu"
          className="absolute inset-0 flex cursor-zoom-in items-center justify-center opacity-0 transition group-hover/thumb:opacity-100"
          style={{ background: "rgba(15,23,42,0.30)" }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-md">
            <Search className="h-4 w-4" style={{ color: "var(--text-main)" }} strokeWidth={2.25} aria-hidden="true" />
          </span>
        </button>
      </DocumentHoverPreview>

      {/* Informations à droite */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] font-bold" style={{ color: "var(--gedify-navy)" }} title={doc.displayTitle}>
            {doc.displayTitle}
          </span>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <DocumentFavoriteStar documentId={doc.id} />
          </div>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          {doc.fileName ? (
            <span className="min-w-0 truncate text-[11.5px]" style={{ color: "var(--text-muted)" }} title={doc.fileName}>{doc.fileName}</span>
          ) : <span />}
          <span className="shrink-0 text-[11px]" style={{ color: "var(--text-hint)" }}>{doc.dateLabel}</span>
        </div>

        {doc.correspondentName ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-main)" }}>
            <Users className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} style={{ color: "var(--text-hint)" }} aria-hidden="true" />
            <span className="truncate">{doc.correspondentName}</span>
          </div>
        ) : null}
        {doc.typeName ? (
          <div className="mt-1 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <Shapes className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} style={{ color: "var(--text-hint)" }} aria-hidden="true" />
            <span className="truncate">{doc.typeName}</span>
          </div>
        ) : null}

        {/* Statut + tags + badges OCR/IA */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusPill tone={status.tone} dot>{status.label}</StatusPill>
          {doc.tags.slice(0, 3).map((t, i) => (
            <span
              key={t.id ?? i}
              className="inline-flex max-w-[110px] items-center truncate rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
              style={{ background: t.color ?? "#EEF2F7", color: t.color ? (t.text_color ?? "#ffffff") : "#475569" }}
              title={t.name}
            >
              {t.name}
            </span>
          ))}
          {doc.tags.length > 3 ? (
            <span className="text-[10.5px] font-semibold" style={{ color: "var(--text-muted)" }}>+{doc.tags.length - 3}</span>
          ) : null}
          <DocumentStatusBadges statuses={doc.statuses} busy={aiBusy} onRetryAi={() => actions.onAi(doc, "analyse")} />
        </div>

        {/* Actions : Ouvrir / Fiche Doc / menu « … » */}
        <div className="mt-auto flex items-center gap-1.5 pt-2.5" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/documents/${doc.id}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Ouvrir le document ${doc.displayTitle}`}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg px-2.5 text-[11px] font-bold text-white transition hover:opacity-90"
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
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2.5 text-[11px] font-bold transition hover:bg-[var(--bg-card-soft)]"
            style={{ background: "var(--surface)", color: "var(--text-main)", borderColor: "var(--border-strong)" }}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden="true" />
            <span className="truncate">Fiche Doc</span>
          </button>
          <DocumentActionMenu doc={doc} actions={actions} aiBusy={aiBusy} />
        </div>
      </div>
    </div>
  );
}
