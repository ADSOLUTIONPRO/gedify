"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkPlus, Loader2, X } from "lucide-react";

type SavedSearch = {
  id: string;
  name: string;
  params: Record<string, string>;
  createdAt: string;
};

function toHref(params: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `/recherche?${qs}` : "/recherche";
}

/** Lit les paramètres de recherche courants de l'URL (hors pagination). */
function currentParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const sp = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  sp.forEach((value, key) => {
    if (key === "page") return;
    if (value) out[key] = value;
  });
  return out;
}

export function SavedSearchesBar() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/search/saved", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as { searches?: SavedSearch[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSearches(data.searches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const params = currentParams();
      const res = await fetch("/api/search/saved", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, params }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }, [name, load]);

  const remove = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/search/saved/${id}`, { method: "DELETE", credentials: "include", cache: "no-store" });
        await load();
      } catch {
        /* ignore */
      }
    },
    [load],
  );

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Bookmark className="h-3.5 w-3.5" /> Recherches sauvegardées
        </span>

        {searches.length === 0 ? (
          <span className="text-[13px] text-slate-400">Aucune pour l&apos;instant.</span>
        ) : (
          searches.map((s) => (
            <span
              key={s.id}
              className="group inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white pl-3 pr-1.5 py-1 text-[13px] font-medium text-slate-700 transition hover:border-blue-300"
            >
              <Link href={toHref(s.params)} className="hover:text-blue-700">
                {s.name}
              </Link>
              <button
                type="button"
                onClick={() => void remove(s.id)}
                className="rounded-full p-0.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Supprimer ${s.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
          placeholder="Nom de la recherche courante…"
          className="h-9 w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !name.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--blue-600)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" strokeWidth={1.75} />}
          Enregistrer
        </button>
        {error ? <span className="text-[12px] font-semibold text-rose-700">{error}</span> : null}
      </div>
    </div>
  );
}
