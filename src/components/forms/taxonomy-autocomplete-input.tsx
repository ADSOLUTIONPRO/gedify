"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, Plus, Tag as TagIcon } from "lucide-react";
import {
  TAXONOMY_CREATE_LABEL,
  TAXONOMY_KIND_LABEL,
  type TaxonomyKind,
} from "@/lib/taxonomies/taxonomy-kinds";

type Item = { id: number | string; kind: TaxonomyKind; name: string; slug: string | null };

type Props = {
  kind: TaxonomyKind;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Autocomplétion de taxonomie réutilisable (workflows, formulaires…).
 * - recherche debounce 250 ms sur /api/taxonomies/search
 * - propose les valeurs existantes + « Créer ‘X’ » si introuvable
 * - navigation clavier (↑/↓/Entrée/Échap), création sur confirmation uniquement
 * - la valeur émise reste le NOM (compatible avec le matching des règles).
 */
export function TaxonomyAutocompleteInput({
  kind,
  value,
  onChange,
  placeholder,
  allowCreate = true,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listboxId = useId();

  // Recherche (debounce 250 ms) quand le menu est ouvert.
  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/taxonomies/search?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(value.trim())}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as { items?: Item[]; canCreate?: boolean };
        setItems(data.items ?? []);
        setCanCreate(Boolean(data.canCreate) && allowCreate);
        setActive(0);
      } catch {
        setItems([]);
        setCanCreate(false);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [value, open, kind, allowCreate]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const select = useCallback((name: string) => {
    onChange(name);
    setOpen(false);
  }, [onChange]);

  const create = useCallback(async () => {
    const name = value.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/taxonomies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name }),
      });
      const data = (await res.json()) as { ok?: boolean; name?: string; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Création impossible.");
      select(data.name ?? name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  }, [value, kind, creating, select]);

  // Nombre total d'options navigables (résultats + éventuelle option « créer »).
  const createIndex = canCreate ? items.length : -1;
  const total = items.length + (canCreate ? 1 : 0);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, total - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Escape") { setOpen(false); }
    else if (e.key === "Enter") {
      if (total === 0) return;
      e.preventDefault();
      if (active === createIndex) void create();
      else if (items[active]) select(items[active].name);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? `${TAXONOMY_KIND_LABEL[kind]}…`}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <div
          id={listboxId}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-auto rounded-xl border bg-white py-1 shadow-lg"
          style={{ borderColor: "var(--border)" }}
          role="listbox"
        >
          {loading ? (
            <p className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Recherche…
            </p>
          ) : null}

          {!loading && items.length === 0 && !canCreate ? (
            <p className="px-3 py-2 text-[12.5px] text-slate-400">Aucune valeur existante.</p>
          ) : null}

          {items.map((it, i) => (
            <button
              key={`${it.kind}-${it.id}`}
              type="button"
              role="option"
              aria-selected={active === i}
              onMouseEnter={() => setActive(i)}
              onClick={() => select(it.name)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition"
              style={{ background: active === i ? "var(--accent-soft, #EFF6FF)" : undefined }}
            >
              <TagIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
              <span className="flex-1 truncate" style={{ color: "var(--text-main)" }}>{it.name}</span>
              {value.trim().toLowerCase() === it.name.toLowerCase() ? (
                <Check className="h-3.5 w-3.5 text-blue-600" />
              ) : (
                <span className="text-[10.5px] text-slate-400">{TAXONOMY_KIND_LABEL[it.kind]}</span>
              )}
            </button>
          ))}

          {canCreate ? (
            <button
              type="button"
              role="option"
              aria-selected={active === createIndex}
              onMouseEnter={() => setActive(createIndex)}
              onClick={() => void create()}
              disabled={creating}
              className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[13px] font-semibold transition disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "#0B5CFF", background: active === createIndex ? "rgba(11,92,255,0.06)" : undefined }}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {TAXONOMY_CREATE_LABEL[kind]} «&nbsp;{value.trim()}&nbsp;»
            </button>
          ) : null}

          {error ? <p className="px-3 py-1.5 text-[11.5px] text-rose-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
