"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

/**
 * Bascule favori AUTONOME (charge son propre état) — pour les contextes hors
 * FavoritesProvider, comme la Fiche Doc. Même API que l'étoile des vignettes.
 */
export function DocumentFavoriteToggle({ documentId, withLabel = false }: { documentId: number; withLabel?: boolean }) {
  const [fav, setFav] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents/favorites", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d: { ids?: number[] }) => { if (!cancelled) { setFav((d.ids ?? []).includes(documentId)); setReady(true); } })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [documentId]);

  async function toggle() {
    const next = !fav;
    setFav(next);
    try {
      const res = await fetch(`/api/documents/${documentId}/favorite`, { method: next ? "POST" : "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
    } catch {
      setFav(!next);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={!ready}
      aria-pressed={fav}
      aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
      className="inline-flex h-9 items-center gap-1.5 rounded-[20px] border-[1.5px] px-3 text-[12.5px] font-bold transition hover:bg-[#FCFAF7] disabled:opacity-50"
      style={{ borderColor: "var(--border-strong)", color: fav ? "#F59E0B" : "var(--text-main)" }}
    >
      <Star className="h-4 w-4" strokeWidth={2} fill={fav ? "currentColor" : "none"} aria-hidden="true" />
      {withLabel ? (fav ? "Favori" : "Favori") : null}
    </button>
  );
}
