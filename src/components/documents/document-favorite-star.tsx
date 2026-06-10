"use client";

import { Star } from "lucide-react";
import { useFavorites } from "@/components/documents/favorites-provider";

/** Étoile « favori » (par utilisateur), DISTINCTE de l'épingle. N'ouvre/ne
 *  sélectionne jamais la carte. */
export function DocumentFavoriteStar({ documentId, className }: { documentId: number; className?: string }) {
  const fav = useFavorites();
  if (!fav) return null;
  const active = fav.has(documentId);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); fav.toggle(documentId); }}
      aria-pressed={active}
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      title={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={className ?? "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:bg-white"}
      style={{ color: active ? "#F59E0B" : "var(--text-hint)" }}
    >
      <Star className="h-4 w-4" strokeWidth={2} fill={active ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
