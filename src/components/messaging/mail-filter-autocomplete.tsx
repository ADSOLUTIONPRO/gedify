"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, Search } from "lucide-react";

export type FilterSuggestion = { name?: string; email?: string; id?: string };

type Props = {
  endpoint: string;
  placeholder: string;
  onSelect: (item: FilterSuggestion) => void;
};

/** Autocomplétion réutilisable (expéditeur / destinataire / label) : debounce 250 ms,
    navigation clavier, états chargement / aucun résultat. */
export function MailFilterAutocomplete({ endpoint, placeholder, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<FilterSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    if (!q.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      return;
    }
    tRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q.trim())}`, { credentials: "include", cache: "no-store" });
        const d = (await res.json()) as { items?: FilterSuggestion[] };
        setItems(Array.isArray(d.items) ? d.items.slice(0, 12) : []);
        setActive(0);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [q, endpoint]);

  function choose(it: FilterSuggestion) {
    onSelect(it);
    setQ("");
    setItems([]);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); choose(items[active]); }
    else if (e.key === "Escape") { setItems([]); }
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg border pl-8 pr-7 text-[12.5px] outline-none focus:border-[var(--accent)]"
        style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
      />
      {loading ? <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin" style={{ color: "var(--text-hint)" }} /> : null}

      {q.trim() && (items.length > 0 || !loading) ? (
        <div className="absolute left-0 right-0 top-[110%] z-30 max-h-56 overflow-auto rounded-xl border bg-white py-1 shadow-lg" style={{ borderColor: "var(--border)" }}>
          {items.length === 0 ? (
            <p className="px-3 py-2 text-[12px]" style={{ color: "var(--text-hint)" }}>Aucun résultat</p>
          ) : (
            items.map((it, i) => (
              <button
                key={(it.email ?? it.id ?? it.name ?? "") + i}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(it); }}
                onMouseEnter={() => setActive(i)}
                className="flex w-full flex-col items-start px-3 py-1.5 text-left transition"
                style={{ background: i === active ? "var(--accent-soft)" : "transparent" }}
              >
                <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{it.name ?? it.email ?? it.id}</span>
                {it.email && it.name ? <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{it.email}</span> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
