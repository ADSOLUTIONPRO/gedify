"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";

type Result = { id: number; title: string; correspondent: string | null; type: string | null; created: string | null; thumbUrl: string };

/**
 * Popup « Joindre depuis la GED » : recherche de documents GED et sélection
 * multiple → ajoutés comme pièces jointes au mail.
 */
export function MailGedPickerPanel({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (docs: { documentId: number; name: string }[]) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/documents/search?q=${encodeURIComponent(q.trim())}`, { credentials: "include" });
        const data = (await res.json()) as { results?: Result[] };
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  function toggle(d: Result) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(d.id)) next.delete(d.id);
      else next.set(d.id, d.title);
      return next;
    });
  }

  function confirm() {
    onAdd([...selected.entries()].map(([documentId, name]) => ({ documentId, name })));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Joindre depuis la GED">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" style={{ border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Joindre depuis la GED</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" strokeWidth={1.75} /></button>
        </div>

        <div className="border-b p-3" style={{ borderColor: "var(--border)" }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un document (titre, correspondant, contenu…)" className="h-10 w-full rounded-xl border pl-9 pr-3 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }} />
          </div>
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Aucun document trouvé.</p>
          ) : (
            <ul className="space-y-1">
              {results.map((d) => {
                const checked = selected.has(d.id);
                return (
                  <li key={d.id}>
                    <button type="button" onClick={() => toggle(d)} className="flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition" style={{ borderColor: checked ? "var(--accent)" : "var(--border)", background: checked ? "var(--accent-soft)" : "#fff" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.thumbUrl} alt="" loading="lazy" className="h-12 w-9 shrink-0 rounded border object-cover object-top" style={{ borderColor: "var(--border)" }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{d.title}</span>
                        <span className="block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{[d.correspondent, d.type].filter(Boolean).join(" · ") || "—"}</span>
                      </span>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: checked ? "var(--accent)" : "#CBD5E1", background: checked ? "var(--accent)" : "#fff" }}>
                        {checked ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-3" style={{ borderColor: "var(--border)" }}>
          <span className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>{selected.size} sélectionné(s)</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-[20px] border-[1.5px] px-4 py-2 text-[13px] font-bold transition hover:bg-[#FCFAF7]" style={{ borderColor: "#374151", color: "#374151" }}>Annuler</button>
            <button type="button" onClick={confirm} disabled={selected.size === 0} className="rounded-[20px] px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
              Ajouter à l&apos;email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
