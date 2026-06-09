"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Search, Sparkles, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { PaperlessDocument, PaperlessListResponse } from "@/lib/paperless-types";

/* ────────────────────────────────────────────────────────────────────────
   Petit sélecteur de document pour « Analyse IA » (tableau de bord). On choisit
   un document (récents par défaut, recherche plein texte), puis on ouvre
   l'assistant IA centré dessus. Aucune logique d'analyse ici : la sélection est
   remontée via onPick(docId).
   ──────────────────────────────────────────────────────────────────────── */

export function AssistantDocumentPicker({
  onPick,
  onClose,
}: {
  onPick: (docId: number, title: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaperlessDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page_size: "15", ordering: "-added" });
    if (q.trim()) params.set("query", q.trim());
    try {
      const res = await fetch(`/api/paperless/documents?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as PaperlessListResponse<PaperlessDocument> & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResults(data.results ?? []);
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  // Chargement initial (documents récents) + raccourci Échap + scroll lock.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void search("");
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Analyse IA — choisir un document">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border-soft)" }}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ background: "linear-gradient(135deg, #F75C8D 0%, #A855F7 54%, #7C3AED 100%)" }}>
              <Sparkles className="h-5 w-5" strokeWidth={1.85} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15.5px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>Analyse IA</h2>
              <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Choisissez le document à analyser avec l&apos;assistant.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-[var(--surface-muted)]" style={{ color: "var(--text-muted)" }}>
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Recherche */}
        <div className="px-5 pt-4">
          <form
            onSubmit={(e) => { e.preventDefault(); void search(query); }}
            className="flex items-center gap-2 rounded-2xl border px-3"
            style={{ borderColor: "var(--border-strong)", background: "var(--bg-card-soft)" }}
          >
            <Search className="h-4 w-4 shrink-0" strokeWidth={1.85} style={{ color: "var(--text-hint)" }} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un document…"
              className="h-10 w-full bg-transparent text-[13.5px] outline-none"
              style={{ color: "var(--text-main)" }}
            />
          </form>
        </div>

        {/* Résultats */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <p className="flex items-center gap-2 px-2 py-6 text-[13px]" style={{ color: "var(--text-muted)" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </p>
          ) : error ? (
            <p className="px-2 py-6 text-[13px] font-semibold" style={{ color: "#9A3412" }}>{error}</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Aucun document trouvé.</p>
          ) : (
            <ul className="space-y-1">
              {results.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => onPick(Number(doc.id), doc.title)}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--accent-soft)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--surface-muted)", color: "var(--text-muted)" }}>
                      <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--text-main)" }}>{doc.title || `Document ${doc.id}`}</span>
                      <span className="block truncate text-[11.5px]" style={{ color: "var(--text-hint)" }}>
                        {doc.correspondent__name ? `${doc.correspondent__name} · ` : ""}{formatDate(doc.created ?? doc.added ?? null)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
