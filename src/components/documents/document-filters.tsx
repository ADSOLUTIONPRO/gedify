"use client";

import { useEffect, useState } from "react";
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

const SESSION_KEY = "gedify.documents.filters.open";

const fieldClass =
  "h-9 w-full rounded-lg border bg-white px-2.5 text-[12.5px] font-medium outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[#FDE7EF]";
const fieldStyle = { borderColor: "var(--border)", color: "var(--text-main)", borderRadius: 8 } as const;

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
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(hasAdvanced);

  // Mémorise l'état ouvert/fermé pendant la session (replié par défaut).
  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") setOpen(true);
  }, []);
  function toggle(next: boolean) {
    setOpen(next);
    try { window.sessionStorage.setItem(SESSION_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  }

  // Filtres actifs (badges). Le « tri » par défaut (-added) n'est pas un filtre.
  const activeChips: { key: string; label: string }[] = [];
  if (values.query) activeChips.push({ key: "query", label: chipLabel("query", values.query, []) });
  if (values.document_type) activeChips.push({ key: "document_type", label: chipLabel("document_type", values.document_type, types) });
  if (values.correspondent) activeChips.push({ key: "correspondent", label: chipLabel("correspondent", values.correspondent, correspondents) });
  if (values.tag) activeChips.push({ key: "tag", label: chipLabel("tag", values.tag, tags) });
  if (values.etat) activeChips.push({ key: "etat", label: chipLabel("etat", values.etat, []) });
  if (values.ordering && values.ordering !== "-added") activeChips.push({ key: "ordering", label: chipLabel("ordering", values.ordering, []) });
  if (values.created_from) activeChips.push({ key: "created_from", label: chipLabel("created_from", values.created_from, []) });
  if (values.added_from) activeChips.push({ key: "added_from", label: chipLabel("added_from", values.added_from, []) });
  if (values.asn) activeChips.push({ key: "asn", label: chipLabel("asn", values.asn, []) });

  const activeCount = activeChips.length;

  /** Lien qui retire UN filtre (navigation : indépendant de l'ouverture du panneau). */
  function hrefWithout(omitKey: string): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(hidden ?? {})) params.set(k, v);
    const entries: [string, string | undefined][] = [
      ["query", values.query], ["document_type", values.document_type], ["correspondent", values.correspondent],
      ["tag", values.tag], ["etat", values.etat], ["ordering", values.ordering],
      ["created_from", values.created_from], ["added_from", values.added_from], ["asn", values.asn],
    ];
    for (const [k, v] of entries) if (v && k !== omitKey) params.set(k, v);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <form action={basePath} className="relative">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {/* ── Barre compacte : bouton « Filtres » + badges actifs ─────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => toggle(!open)}
          aria-expanded={open}
          className="inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-[13px] font-bold transition hover:bg-[var(--bg-card-soft)]"
          style={open
            ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" }
            : { borderColor: "var(--border-strong)", color: "var(--text-main)" }}
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.85} />
          Filtres
          {activeCount > 0 && (
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold text-white"
              style={{ background: "var(--accent)" }}
            >
              {activeCount}
            </span>
          )}
        </button>

        {/* Badges des filtres actifs (croix = retrait immédiat) */}
        {activeChips.map((chip) => (
          <Link
            key={chip.key}
            href={hrefWithout(chip.key)}
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11.5px] font-semibold transition hover:opacity-80"
            style={{ borderColor: "rgba(247,92,141,0.3)", background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            {chip.label}
            <X className="h-3 w-3" strokeWidth={2.5} />
          </Link>
        ))}

        {activeCount > 0 && (
          <Link
            href={resetHref}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold transition hover:bg-slate-50"
            style={{ color: "var(--text-muted)" }}
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Réinitialiser
          </Link>
        )}
      </div>

      {/* ── Panneau dépliable (drawer plein écran en mobile, carte inline desktop) ── */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Fermer les filtres"
            onClick={() => toggle(false)}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm sm:hidden"
          />
          <div
            className="animate-filter-in fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col overflow-y-auto rounded-t-3xl border p-4 shadow-2xl sm:static sm:z-auto sm:mt-2 sm:max-h-none sm:rounded-2xl sm:p-4 sm:shadow-sm"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            role="dialog"
            aria-label="Filtres des documents"
          >
            <div className="mb-3 flex items-center justify-between sm:hidden">
              <p className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Filtres</p>
              <button type="button" onClick={() => toggle(false)} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full" style={{ color: "var(--text-muted)" }}>
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Recherche par mots-clés" className="sm:col-span-2 lg:col-span-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
                  <input name="query" type="search" defaultValue={values.query} placeholder="Titre, contenu, ASN…" className={`${fieldClass} pl-8`} style={fieldStyle} />
                </div>
              </Field>

              <Field label="Type de document">
                <select name="document_type" defaultValue={values.document_type} className={fieldClass} style={fieldStyle}>
                  <option value="">Tous les types</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>

              <Field label="Correspondant">
                <select name="correspondent" defaultValue={values.correspondent} className={fieldClass} style={fieldStyle}>
                  <option value="">Tous les correspondants</option>
                  {correspondents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>

              <Field label="Tags">
                <select name="tag" defaultValue={values.tag} className={fieldClass} style={fieldStyle}>
                  <option value="">Tous les tags</option>
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>

              <Field label="État">
                <select name="etat" defaultValue={values.etat} className={fieldClass} style={fieldStyle}>
                  <option value="">Tous les états</option>
                  {Object.entries(ETAT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>

              <Field label="Tri">
                <select name="ordering" defaultValue={values.ordering ?? "-added"} className={fieldClass} style={fieldStyle}>
                  <option value="-added">Plus récent</option>
                  <option value="added">Plus ancien</option>
                  <option value="title">Titre A-Z</option>
                  <option value="-created">Date du document récente</option>
                  <option value="created">Date du document ancienne</option>
                </select>
              </Field>
            </div>

            {/* Plus de filtres (dates, ASN) */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold transition hover:opacity-80"
              style={{ color: "var(--accent)" }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.85} />
              {showAdvanced ? "Moins de filtres" : "Plus de filtres"}
            </button>
            {showAdvanced && (
              <div className="mt-2 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-3" style={{ borderColor: "var(--border-soft)" }}>
                <Field label="Date du document depuis">
                  <input type="date" name="created_from" defaultValue={values.created_from} className={fieldClass} style={fieldStyle} />
                </Field>
                <Field label="Ajouté depuis">
                  <input type="date" name="added_from" defaultValue={values.added_from} className={fieldClass} style={fieldStyle} />
                </Field>
                <Field label="ASN">
                  <select name="asn" defaultValue={values.asn} className={fieldClass} style={fieldStyle}>
                    <option value="">Tous</option>
                    <option value="with">Avec ASN</option>
                    <option value="without">Sans ASN</option>
                  </select>
                </Field>
              </div>
            )}

            {/* Pied : Appliquer / Réinitialiser / Fermer */}
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
              <Link
                href={resetHref}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-[12.5px] font-semibold transition hover:bg-[var(--bg-card-soft)]"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-main)" }}
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} /> Réinitialiser
              </Link>
              <button
                type="button"
                onClick={() => toggle(false)}
                className="inline-flex h-9 items-center rounded-xl border px-3.5 text-[12.5px] font-semibold transition hover:bg-[var(--bg-card-soft)]"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-main)" }}
              >
                Fermer
              </button>
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-xl px-5 text-[12.5px] font-bold text-white transition hover:opacity-90"
                style={{ background: "var(--accent)" }}
              >
                Appliquer
              </button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}
