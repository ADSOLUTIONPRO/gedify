"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Plus, Search } from "lucide-react";

export type AutocompleteSuggestion = {
  id: string | number;
  label: string;
  helper?: string;
};

type Props = {
  /** Endpoint that accepts `?q=` and returns `{ items: AutocompleteSuggestion[] }`. */
  endpoint: string;
  /** Currently selected display value. */
  value: string;
  onChange: (value: string, suggestion?: AutocompleteSuggestion) => void;
  placeholder?: string;
  /** If provided, "Créer X" appears at the bottom of the dropdown for new values. */
  allowCreate?: boolean;
  onCreate?: (query: string) => void;
  /** Extra query parameters added to the endpoint URL (e.g. `{ type: "expense" }`). */
  extraParams?: Record<string, string>;
  disabled?: boolean;
  className?: string;
};

export function AutocompleteInput({
  endpoint,
  value,
  onChange,
  placeholder = "Rechercher…",
  allowCreate,
  onCreate,
  extraParams,
  disabled,
  className = "",
}: Props) {
  // Controlled by `value`. The input is fully controlled by the parent; the parent must
  // remount with a `key` to hard-reset. We only track UI state (open, items, loading).
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const query = value;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let cancelled = false;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) params.set(k, v);
      }
    }
    const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;

    async function run() {
      setLoading(true);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { items: AutocompleteSuggestion[] };
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, query, endpoint, extraParams]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function select(item: AutocompleteSuggestion) {
    onChange(item.label, item);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex h-9 w-full items-center">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400"
          strokeWidth={1.75}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          className="h-full w-full rounded-xl border border-slate-200 bg-white pl-8 pr-7 text-xs font-medium text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2 h-3 w-3 text-slate-400"
          strokeWidth={2}
        />
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.18)]">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
              Recherche…
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">Aucun résultat</div>
          ) : (
            <ul className="max-h-64 overflow-auto py-1">
              {items.map((item) => (
                <li key={String(item.id)}>
                  <button
                    type="button"
                    onClick={() => select(item)}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-800">{item.label}</span>
                    {item.helper ? (
                      <span className="text-[10px] text-slate-500">{item.helper}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {allowCreate && query.trim().length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onCreate?.(query.trim());
                setOpen(false);
              }}
              className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              <Plus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Créer « {query.trim()} »
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
