"use client";

import { useEffect, useState } from "react";
import { Plus, Users, X } from "lucide-react";
import { AutocompleteInput, type AutocompleteSuggestion } from "@/components/ui/autocomplete-input";

type Item = { id: number; name: string };

/**
 * Éditeur de correspondants SECONDAIRES d'un document (en plus du correspondant
 * principal Gedify). Ajout par autocomplétion + création ; suppression par
 * puce. Affiche aussi les correspondants proposés par l'IA en ajout rapide.
 */
export function DocumentSecondaryCorrespondents({
  documentId,
  suggestions = [],
}: {
  documentId: number;
  /** Noms proposés par l'IA (ajout rapide). */
  suggestions?: string[];
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${documentId}/correspondents`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Item[] }) => { if (!cancelled) setItems(d.items ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [documentId]);

  async function add(name: string) {
    const value = name.trim();
    if (!value || busy) return;
    setBusy(true);
    setQuery("");
    try {
      const res = await fetch(`/api/documents/${documentId}/correspondents`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      const d = (await res.json().catch(() => ({}))) as { items?: Item[] };
      if (res.ok && d.items) setItems(d.items);
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/correspondents`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeId: id }),
      });
      const d = (await res.json().catch(() => ({}))) as { items?: Item[] };
      if (res.ok && d.items) setItems(d.items);
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  const known = new Set(items.map((i) => i.name.toLowerCase()));
  const pendingSuggestions = suggestions.filter((s) => s.trim() && !known.has(s.trim().toLowerCase()));

  return (
    <div>
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
        <Users className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden="true" /> Correspondants associés
      </span>
      {items.length > 0 ? (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {items.map((it) => (
            <span key={it.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#F1F5F9", color: "#475569" }}>
              {it.name}
              <button type="button" onClick={() => void remove(it.id)} aria-label={`Retirer ${it.name}`} disabled={busy}><X className="h-3 w-3" strokeWidth={2.5} /></button>
            </span>
          ))}
        </div>
      ) : null}
      <AutocompleteInput
        endpoint="/api/autocomplete/correspondents"
        value={query}
        allowCreate
        placeholder="Ajouter un correspondant associé…"
        onChange={(v, s?: AutocompleteSuggestion) => { if (s) void add(s.label); else setQuery(v); }}
        onCreate={(n) => void add(n)}
      />
      {pendingSuggestions.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>IA :</span>
          {pendingSuggestions.map((s) => (
            <button key={s} type="button" onClick={() => void add(s)} disabled={busy} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition hover:opacity-90" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Plus className="h-3 w-3" strokeWidth={2.5} /> {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
