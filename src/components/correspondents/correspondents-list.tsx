"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronLeft, ChevronRight, Mail, Search } from "lucide-react";
import { avatarColor, initials } from "@/components/messaging/mail-list-utils";
import type { CorrespondentVM } from "./correspondents-workspace";

type ListFilter = "all" | "withDocs" | "noDocs" | "toMerge";
type SortKey = "name-asc" | "name-desc" | "docs-desc";

const PER_PAGE_OPTIONS = [10, 25, 50];

type Props = {
  items: CorrespondentVM[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  toMergeCount: number;
};

export function CorrespondentsList({ items, selectedId, onSelect, toMergeCount }: Props) {
  const [filter, setFilter] = useState<ListFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const counts = useMemo(
    () => ({
      all: items.length,
      withDocs: items.filter((c) => c.documentCount > 0).length,
      noDocs: items.filter((c) => c.documentCount === 0).length,
      toMerge: toMergeCount,
    }),
    [items, toMergeCount],
  );

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase();
    const base = items.filter((c) => {
      if (filter === "withDocs" && c.documentCount === 0) return false;
      if (filter === "noDocs" && c.documentCount > 0) return false;
      if (filter === "toMerge" && !c.isDuplicate) return false;
      if (kw && !`${c.name} ${c.organization ?? ""}`.toLowerCase().includes(kw)) return false;
      return true;
    });
    const sorted = [...base].sort((a, b) => {
      if (sort === "docs-desc") return b.documentCount - a.documentCount || a.name.localeCompare(b.name, "fr");
      const cmp = a.name.localeCompare(b.name, "fr");
      return sort === "name-desc" ? -cmp : cmp;
    });
    return sorted;
  }, [items, filter, query, sort]);

  // Pagination (clamp si la page sort des bornes après filtrage).
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  function changeFilter(f: ListFilter) {
    setFilter(f);
    setPage(1);
  }

  const FILTERS: { key: ListFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "withDocs", label: "Avec docs" },
    { key: "noDocs", label: "Sans docs" },
    { key: "toMerge", label: "À fusionner" },
  ];

  return (
    <div className="flex min-h-0 flex-col rounded-2xl border bg-white" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}>
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-1.5 border-b p-2.5" style={{ borderColor: "var(--border-soft)" }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => changeFilter(f.key)}
              className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition"
              style={{
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${active ? "color-mix(in srgb, var(--accent) 35%, white)" : "var(--border)"}`,
              }}
            >
              {f.label}
              <span style={{ color: active ? "var(--accent)" : "var(--text-hint)" }}>{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Recherche + tri */}
      <div className="flex items-center gap-2 border-b p-2.5" style={{ borderColor: "var(--border-soft)" }}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} />
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Rechercher dans la liste…"
            className="h-9 w-full rounded-xl border pl-9 pr-3 text-[13px] outline-none transition focus:border-[var(--accent)]"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 rounded-xl border px-2 text-[12.5px] font-medium outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
          aria-label="Trier"
        >
          <option value="name-asc">Tri : Nom (A-Z)</option>
          <option value="name-desc">Tri : Nom (Z-A)</option>
          <option value="docs-desc">Tri : Documents</option>
        </select>
        <button
          type="button"
          onClick={() => setSort((s) => (s === "name-asc" ? "name-desc" : "name-asc"))}
          title="Inverser l'ordre"
          aria-label="Inverser l'ordre"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition hover:bg-[var(--bg-card-soft)]"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          <ArrowDownUp className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Liste */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center" style={{ color: "var(--text-hint)" }}>
            <Mail className="mb-2 h-8 w-8" strokeWidth={1.25} />
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun correspondant</p>
          </div>
        ) : (
          <ul>
            {pageItems.map((c) => {
              const isSelected = c.id === selectedId;
              const color = avatarColor(c.name);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition hover:bg-[var(--bg-card-soft)]"
                    style={{
                      borderColor: "var(--border-soft)",
                      borderLeft: `3px solid ${isSelected ? "var(--accent)" : "transparent"}`,
                      background: isSelected ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: color }}>
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold" style={{ color: "var(--text-main)" }}>{c.name}</span>
                      <span className="block truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {c.organization ?? (c.documentCount > 0 ? `${c.documentCount} document${c.documentCount > 1 ? "s" : ""}` : "Aucun document")}
                      </span>
                    </span>
                    {c.isDuplicate ? (
                      <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--gedify-orange-soft)", color: "#B45309" }}>
                        Doublon
                      </span>
                    ) : c.documentCount > 0 ? (
                      <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums" style={{ background: "var(--bg-card-soft)", color: "var(--text-muted)" }}>
                        {c.documentCount}
                      </span>
                    ) : null}
                    <Mail className="h-4 w-4 shrink-0" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2" style={{ borderColor: "var(--border-soft)" }}>
        <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          {filtered.length === 0 ? "0" : `${start + 1}–${Math.min(start + perPage, filtered.length)}`} sur {filtered.length.toLocaleString("fr-FR")}
        </span>
        <div className="flex items-center gap-1">
          <PagerButton dir="prev" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} />
          {pageNumbers(currentPage, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="px-1 text-[12px]" style={{ color: "var(--text-hint)" }}>…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className="h-7 min-w-7 rounded-lg px-2 text-[12px] font-semibold transition"
                style={p === currentPage
                  ? { background: "var(--accent-soft)", color: "var(--accent)" }
                  : { color: "var(--text-muted)" }}
              >
                {p}
              </button>
            ),
          )}
          <PagerButton dir="next" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} />
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="ml-1 h-7 rounded-lg border px-1.5 text-[11.5px] outline-none"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-muted)" }}
            aria-label="Par page"
          >
            {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function PagerButton({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Précédent" : "Suivant"}
      className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[var(--bg-card-soft)] disabled:opacity-30"
      style={{ color: "var(--text-muted)" }}
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

/** Numéros de page avec ellipses : 1 … 4 5 [6] 7 8 … 125. */
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}
