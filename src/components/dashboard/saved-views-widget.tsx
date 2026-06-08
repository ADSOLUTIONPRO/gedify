"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Loader2, X } from "lucide-react";

type View = { id: string; name: string; query: string; isPinned: boolean };

/** Widget tableau de bord : vues documentaires enregistrées (par utilisateur). */
export function SavedViewsWidget() {
  const [views, setViews] = useState<View[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/document-views", { credentials: "include", cache: "no-store" });
      if (res.ok) { const d = (await res.json()) as { views?: View[] }; setViews(d.views ?? []); }
    } catch { /* hors-ligne */ } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function remove(id: string) {
    setViews((prev) => prev.filter((v) => v.id !== id));
    await fetch(`/api/document-views/${id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
  }

  if (loading) return <div className="flex items-center gap-2 py-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>;
  if (views.length === 0) {
    return <p className="py-3 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucune vue. Filtrez vos documents puis « Enregistrer la vue ».</p>;
  }

  return (
    <ul className="space-y-1">
      {views.map((v) => (
        <li key={v.id} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-[var(--bg-card-soft)]">
          <Link href={`/documents${v.query ? `?${v.query}` : ""}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <Bookmark className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden="true" />
            </span>
            <span className="truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{v.name}</span>
          </Link>
          <button type="button" onClick={() => void remove(v.id)} aria-label={`Supprimer ${v.name}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-0 transition hover:bg-white group-hover:opacity-100" style={{ color: "var(--text-muted)" }}>
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </li>
      ))}
    </ul>
  );
}
