"use client";

import { useState } from "react";
import { ChevronDown, Layers, Pencil, Sparkles, X } from "lucide-react";
import { BadgeTag } from "@/components/ui/badge-tag";
import { StatusPill } from "@/components/ui/status-pill";
import { DocumentMetadataForm } from "@/components/forms/document-metadata-form";
import type {
  PaperlessCorrespondent,
  PaperlessDocument,
  PaperlessDocumentType,
  PaperlessTag,
} from "@/lib/paperless-types";

type TagVM = { id: number; name: string; color?: string; text_color?: string };
type SuggestionGroups = { correspondents: string[]; types: string[]; tags: string[]; dates: string[] };

type DocumentInfoCardProps = {
  document: PaperlessDocument;
  correspondents: PaperlessCorrespondent[];
  documentTypes: PaperlessDocumentType[];
  tags: PaperlessTag[];
  correspondentName: string | null;
  typeName: string | null;
  dateCreated: string;
  dateAdded: string;
  asn: string | null;
  pages: number | null;
  statusLabel: string;
  statusTone: "amber" | "emerald" | "slate";
  documentTags: TagVM[];
  suggestions: SuggestionGroups | null;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[11.5px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-right text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{value}</span>
    </div>
  );
}

function SuggAccordion({ label, items }: { label: string; items: string[] }) {
  return (
    <details className="rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>
        {label}
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "#F1F5F9", color: "#475569" }}>{items.length}</span>
      </summary>
      <div className="px-3 pb-2.5">
        {items.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {items.map((it, i) => (
              <span key={i} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#F1F5F9", color: "#475569" }}>{it}</span>
            ))}
          </div>
        ) : (
          <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>Aucune suggestion.</p>
        )}
      </div>
    </details>
  );
}

/**
 * Bloc unifié « Classement et métadonnées » : vue lisible + bouton Modifier
 * (réutilise `DocumentMetadataForm`) + suggestions Gedify en accordéons
 * collapsés par défaut.
 */
export function DocumentInfoCard({
  document,
  correspondents,
  documentTypes,
  tags,
  correspondentName,
  typeName,
  dateCreated,
  dateAdded,
  asn,
  pages,
  statusLabel,
  statusTone,
  documentTags,
  suggestions,
}: DocumentInfoCardProps) {
  const [editing, setEditing] = useState(false);
  const [showSugg, setShowSugg] = useState(false);
  const hasSugg = !!suggestions && (suggestions.correspondents.length + suggestions.types.length + suggestions.tags.length + suggestions.dates.length) > 0;

  return (
    <section className="rounded-[20px] border bg-white" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <h3 className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>
          <Layers className="h-4 w-4" style={{ color: "var(--text-muted)" }} strokeWidth={2} aria-hidden="true" />
          Classement et métadonnées
        </h3>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-[20px] border-[1.5px] px-3 text-[12px] font-bold transition hover:bg-[#FCFAF7]"
          style={{ borderColor: "#374151", color: "#374151" }}
        >
          {editing ? <><X className="h-3.5 w-3.5" strokeWidth={2} />Annuler</> : <><Pencil className="h-3.5 w-3.5" strokeWidth={2} />Modifier</>}
        </button>
      </div>

      <div className="p-4">
        {editing ? (
          <DocumentMetadataForm document={document} correspondents={correspondents} documentTypes={documentTypes} tags={tags} />
        ) : (
          <div className="space-y-3">
            <dl>
              <Row label="Correspondant" value={correspondentName ?? "—"} />
              <Row label="Type de document" value={typeName ?? "—"} />
              <Row label="Date du document" value={dateCreated} />
              <Row label="Date d'ajout" value={dateAdded} />
              {asn ? <Row label="Numéro d'archive" value={asn} /> : null}
              <Row label="Pages" value={String(pages ?? "—")} />
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-[11.5px] font-medium" style={{ color: "var(--text-muted)" }}>Statut</span>
                <StatusPill tone={statusTone} dot>{statusLabel}</StatusPill>
              </div>
            </dl>
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>Tags</p>
              <div className="flex flex-wrap gap-1">
                {documentTags.length > 0 ? (
                  documentTags.map((t) => <BadgeTag key={t.id} tag={t} compact />)
                ) : (
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>Aucun tag</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Suggestions Gedify */}
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => setShowSugg((v) => !v)}
            aria-expanded={showSugg}
            className="flex w-full items-center justify-between gap-2 text-[12.5px] font-bold"
            style={{ color: "var(--text-main)" }}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} strokeWidth={2} aria-hidden="true" />
              Suggestions Gedify
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showSugg ? "rotate-180" : ""}`} style={{ color: "var(--text-hint)" }} strokeWidth={2} aria-hidden="true" />
          </button>
          {showSugg ? (
            <div className="mt-2 space-y-1.5">
              {hasSugg && suggestions ? (
                <>
                  <SuggAccordion label="Correspondant proposé" items={suggestions.correspondents} />
                  <SuggAccordion label="Type proposé" items={suggestions.types} />
                  <SuggAccordion label="Tags proposés" items={suggestions.tags} />
                  <SuggAccordion label="Dates détectées" items={suggestions.dates} />
                </>
              ) : (
                <p className="text-[12px]" style={{ color: "var(--text-hint)" }}>Aucune suggestion Gedify pour ce document.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
