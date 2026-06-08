"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   Autocomplétion d'entité réutilisable (taxonomies + dossiers).
   - Liste complète visible DÈS le focus (sans saisir), triée A→Z côté serveur.
   - Recherche en filtrant ; création find-or-create (même route que la Fiche
     Doc → persistance en base, plus de doublon) ; sélection simple ou multiple.
   - Navigation clavier ↑/↓/Entrée/Échap.
   ──────────────────────────────────────────────────────────────────────── */

export type EntityOption = { id: number | string; name: string };
export type EntityType = "tag" | "correspondent" | "documentType" | "project" | "budgetCategory";

const ENTITY: Record<EntityType, { search: string; create: string | null }> = {
  tag: { search: "/api/autocomplete/tags", create: "/api/paperless/tags" },
  correspondent: { search: "/api/autocomplete/correspondents", create: "/api/paperless/correspondents" },
  documentType: { search: "/api/autocomplete/document-types", create: "/api/paperless/document-types" },
  project: { search: "/api/autocomplete/projects", create: "/api/projects" },
  budgetCategory: { search: "/api/autocomplete/budget-categories", create: null },
};

type ApiItem = { id: number | string; label: string };

export function EntityAutocomplete({
  entityType,
  value,
  onChange,
  multiple = false,
  allowCreate = false,
  disabled = false,
  placeholder,
}: {
  entityType: EntityType;
  value: EntityOption | EntityOption[] | null;
  onChange: (value: EntityOption | EntityOption[] | null) => void;
  multiple?: boolean;
  allowCreate?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const cfg = ENTITY[entityType];
  const selected = (multiple ? (Array.isArray(value) ? value : []) : null) as EntityOption[] | null;
  const single = (!multiple ? (value && !Array.isArray(value) ? value : null) : null) as EntityOption | null;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const fetchItems = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${cfg.search}?q=${encodeURIComponent(q)}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items?: ApiItem[] };
      setItems((data.items ?? []).map((i) => ({ id: i.id, name: i.label })));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [cfg.search]);

  // Ouverture → charge la liste complète ; saisie → filtre (debounce).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void fetchItems(query.trim()), query ? 220 : 0);
    return () => clearTimeout(t);
  }, [open, query, fetchItems]);

  // Clic extérieur → ferme.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const selectedIds = new Set((selected ?? []).map((s) => String(s.id)));
  const q = query.trim();
  const filtered = items.filter((i) => !multiple || !selectedIds.has(String(i.id)));
  const exact = filtered.some((i) => i.name.toLowerCase() === q.toLowerCase()) || (single?.name.toLowerCase() === q.toLowerCase());
  const showCreate = allowCreate && cfg.create && q.length > 0 && !exact && !creating;
  const optionCount = filtered.length + (showCreate ? 1 : 0);

  function commit(option: EntityOption) {
    if (multiple) {
      onChange([...(selected ?? []), option]);
      setQuery("");
      void fetchItems("");
    } else {
      onChange(option);
      setQuery(option.name);
      setOpen(false);
    }
    setHighlight(0);
  }

  async function create() {
    if (!cfg.create || !q) return;
    setCreating(true);
    try {
      const res = await fetch(cfg.create, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ name: q }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { id: number | string; name?: string };
      commit({ id: data.id, name: data.name ?? q });
    } catch {
      /* création impossible — l'utilisateur peut réessayer */
    } finally {
      setCreating(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(optionCount - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
    else if (e.key === "Escape") { setOpen(false); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight < filtered.length) commit(filtered[highlight]);
      else if (showCreate) void create();
    }
  }

  function removeChip(id: number | string) {
    onChange((selected ?? []).filter((s) => String(s.id) !== String(id)));
  }

  return (
    <div ref={rootRef} className="relative">
      {multiple && (selected?.length ?? 0) > 0 ? (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {selected!.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              {s.name}
              <button type="button" onClick={() => removeChip(s.id)} aria-label={`Retirer ${s.name}`} disabled={disabled}><X className="h-3 w-3" strokeWidth={2.5} /></button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1 rounded-xl border px-2.5" style={{ borderColor: "var(--border)", background: disabled ? "var(--surface-muted)" : "var(--surface)" }}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          disabled={disabled}
          value={multiple ? query : (open ? query : single?.name ?? "")}
          placeholder={single && !open ? undefined : (placeholder ?? "Rechercher ou créer…")}
          onFocus={() => { setOpen(true); if (!multiple && single) setQuery(single.name); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!multiple && single) onChange(null); }}
          onKeyDown={onKeyDown}
          className="h-9 w-full bg-transparent text-[13px] outline-none"
          style={{ color: "var(--text-main)" }}
        />
        {!multiple && single && !disabled ? (
          <button type="button" onClick={() => { onChange(null); setQuery(""); inputRef.current?.focus(); }} aria-label="Effacer" className="shrink-0" style={{ color: "var(--text-hint)" }}>
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--text-hint)" }} aria-hidden="true" />
        )}
      </div>

      {open && !disabled ? (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: "var(--border)" }}>
          {loading && filtered.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…</li>
          ) : filtered.length === 0 && !showCreate ? (
            <li className="px-3 py-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucune valeur.</li>
          ) : null}
          {filtered.map((i, idx) => {
            const isSel = single && String(single.id) === String(i.id);
            return (
              <li key={i.id} role="option" aria-selected={Boolean(isSel)}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => commit(i)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] font-medium transition"
                  style={{ background: highlight === idx ? "var(--bg-card-soft)" : "transparent", color: "var(--text-main)" }}
                >
                  <span className="truncate">{i.name}</span>
                  {isSel ? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2.25} /> : null}
                </button>
              </li>
            );
          })}
          {showCreate ? (
            <li role="option" aria-selected={highlight === filtered.length}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(filtered.length)}
                onClick={() => void create()}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold transition"
                style={{ background: highlight === filtered.length ? "var(--accent-soft)" : "transparent", color: "var(--accent)" }}
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />}
                Créer «&nbsp;{q}&nbsp;»
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
