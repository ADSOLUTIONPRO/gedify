"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";

type Option = { id: number | string; name: string };

export type DocumentFilterValues = {
  query?: string;
  correspondent?: string;
  document_type?: string;
  tag?: string;
  created_from?: string;
  added_from?: string;
  asn?: string;
  ordering?: string;
  /** Filtre sur les statuts dérivés IA / OCR / budget (post-filtrage côté serveur). */
  etat?: string;
};

/** Libellés des états IA/OCR/budget (filtre « État »). */
export const ETAT_LABELS: Record<string, string> = {
  ia_done: "IA terminé",
  ia_review: "Suggestions à vérifier",
  ia_error: "IA erreur",
  ia_none: "IA non analysé",
  ocr_done: "OCR terminé",
  ocr_error: "OCR manquant",
  ocr_low: "OCR faible",
  classified: "Classé",
  unclassified: "À classer",
  budget_created: "Budget créé",
  budget_review: "Budget à vérifier",
};

type DocumentFiltersProps = {
  values: DocumentFilterValues;
  correspondents: Option[];
  types: Option[];
  tags: Option[];
  hidden?: Record<string, string>;
  resetHref: string;
  /** Cible du formulaire de filtres (défaut /documents ; ex. /organiser/dossiers). */
  basePath?: string;
};

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2 text-[12px] font-medium outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#FDE7EF]";

function chipLabel(key: string, value: string, options: Option[]): string {
  if (key === "query") return `"${value}"`;
  if (key === "ordering") return `Tri : ${value}`;
  if (key === "created_from") return `Depuis : ${value}`;
  if (key === "added_from") return `Ajouté depuis : ${value}`;
  if (key === "asn") return value === "with" ? "Avec ASN" : "Sans ASN";
  if (key === "etat") return ETAT_LABELS[value] ?? value;
  const opt = options.find((o) => String(o.id) === value);
  return opt?.name ?? value;
}

export function DocumentFilters({
  values,
  correspondents,
  types,
  tags,
  hidden,
  resetHref,
  basePath = "/documents",
}: DocumentFiltersProps) {
  const hasAdvanced = Boolean(values.created_from || values.added_from || values.asn);
  const [showAdvanced, setShowAdvanced] = useState(hasAdvanced);
  const formRef = useRef<HTMLFormElement>(null);

  // Chips : filtres actifs visibles
  const activeChips: { key: string; label: string }[] = [];
  if (values.query) activeChips.push({ key: "query", label: chipLabel("query", values.query, []) });
  if (values.document_type) activeChips.push({ key: "document_type", label: chipLabel("document_type", values.document_type, types) });
  if (values.correspondent) activeChips.push({ key: "correspondent", label: chipLabel("correspondent", values.correspondent, correspondents) });
  if (values.tag) activeChips.push({ key: "tag", label: chipLabel("tag", values.tag, tags) });
  if (values.etat) activeChips.push({ key: "etat", label: chipLabel("etat", values.etat, []) });
  if (values.created_from) activeChips.push({ key: "created_from", label: chipLabel("created_from", values.created_from, []) });
  if (values.added_from) activeChips.push({ key: "added_from", label: chipLabel("added_from", values.added_from, []) });
  if (values.asn) activeChips.push({ key: "asn", label: chipLabel("asn", values.asn, []) });

  function removeFilter(key: string) {
    if (!formRef.current) return;
    const el = formRef.current.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement | null;
    if (el) el.value = "";
    formRef.current.submit();
  }

  return (
    <form ref={formRef} action={basePath}>
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {/* ── TRI (séparé, au-dessus de la barre de filtres) ── */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Trier</span>
        <select
          name="ordering"
          defaultValue={values.ordering ?? "-added"}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={fieldClass}
          style={{ borderColor: "var(--border)", color: "var(--text-main)", borderRadius: 8, width: "auto", minWidth: "150px" }}
        >
          <option value="-added">Plus récent</option>
          <option value="added">Plus ancien</option>
          <option value="title">Titre A-Z</option>
          <option value="-created">Date du document récente</option>
          <option value="created">Date du document ancienne</option>
        </select>
      </div>

      {/* ── BARRE DE FILTRES ── */}
      <div className="rounded-xl border bg-white" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}>
        <div className="p-2">
          {/* Filtres toujours visibles : mots-clés · Type · Correspondant · Tag · État */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="relative min-w-0 flex-1" style={{ minWidth: "150px", maxWidth: "320px" }}>
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
              <input
                name="query"
                type="search"
                defaultValue={values.query}
                placeholder="Mots-clés (titre, contenu, ASN…)"
                className={`${fieldClass} pl-7`}
                style={{ borderColor: "var(--border)", color: "var(--text-main)", borderRadius: 8 }}
              />
            </div>

            <select name="document_type" defaultValue={values.document_type} className={fieldClass} style={{ borderColor: "var(--border)", color: "var(--text-main)", borderRadius: 8, width: "auto", minWidth: "112px" }}>
              <option value="">Type…</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <select name="correspondent" defaultValue={values.correspondent} className={fieldClass} style={{ borderColor: "var(--border)", color: "var(--text-main)", borderRadius: 8, width: "auto", minWidth: "112px" }}>
              <option value="">Correspondant…</option>
              {correspondents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select name="tag" defaultValue={values.tag} className={fieldClass} style={{ borderColor: "var(--border)", color: "var(--text-main)", borderRadius: 8, width: "auto", minWidth: "98px" }}>
              <option value="">Tag…</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <select name="etat" defaultValue={values.etat} className={fieldClass} style={{ borderColor: "var(--border)", color: "var(--text-main)", borderRadius: 8, width: "auto", minWidth: "112px" }}>
              <option value="">État…</option>
              {Object.entries(ETAT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>

            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-[12px] font-bold text-white transition hover:opacity-90"
              style={{ background: "var(--gedify-navy)", borderRadius: 8 }}
            >
              Filtrer
            </button>

            {/* « ··· » : filtres secondaires (dates, ASN) */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-label="Plus de filtres"
              className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border px-3 text-[12px] font-semibold transition hover:bg-[var(--bg-card-soft)]"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)", borderRadius: 8 }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
              {showAdvanced ? "Moins" : "Plus de filtres"}
            </button>

            {activeChips.length > 0 && (
              <Link
                href={resetHref}
                className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-[12.5px] font-semibold transition hover:bg-slate-50"
                style={{ color: "var(--text-muted)" }}
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                Reset
              </Link>
            )}
          </div>

          {/* Filtres avancés (dans le « ··· ») */}
          {showAdvanced && (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-3 lg:grid-cols-4" style={{ borderColor: "var(--border-soft)" }}>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Date document depuis</span>
                <input type="date" name="created_from" defaultValue={values.created_from} className={fieldClass} style={{ borderColor: "var(--border)", color: "var(--text-main)", borderRadius: 8 }} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Ajouté depuis</span>
                <input type="date" name="added_from" defaultValue={values.added_from} className={fieldClass} style={{ borderColor: "var(--border)", color: "var(--text-main)", borderRadius: 8 }} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>ASN</span>
                <select name="asn" defaultValue={values.asn} className={fieldClass} style={{ borderColor: "var(--border)", color: "var(--text-main)", borderRadius: 8 }}>
                  <option value="">Tous</option>
                  <option value="with">Avec ASN</option>
                  <option value="without">Sans ASN</option>
                </select>
              </label>
            </div>
          )}
        </div>

        {/* Chips des filtres actifs */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t px-3.5 py-2.5" style={{ borderColor: "var(--border-soft)" }}>
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Actifs :</span>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => removeFilter(chip.key)}
                className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11.5px] font-semibold transition hover:opacity-80"
                style={{ borderColor: "rgba(247,92,141,0.3)", background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {chip.label}
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
