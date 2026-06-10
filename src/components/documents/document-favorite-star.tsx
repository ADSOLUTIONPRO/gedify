"use client";

import { Pin } from "lucide-react";
import { useFavorites } from "@/components/documents/favorites-provider";

/**
 * Bouton « Épingler » un document (par utilisateur). Les documents épinglés
 * apparaissent dans le widget « Documents épinglés » du tableau de bord.
 * N'ouvre/ne sélectionne jamais la carte. (Conserve le nom historique du
 * composant et le store « favorites » comme support technique.)
 */
export function DocumentFavoriteStar({ documentId, className }: { documentId: number; className?: string }) {
  const fav = useFavorites();
  if (!fav) return null;
  const active = fav.has(documentId);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); fav.toggle(documentId); }}
      aria-pressed={active}
      aria-label={active ? "Détacher du tableau de bord" : "Épingler au tableau de bord"}
      title={active ? "Détacher" : "Épingler"}
      className={className ?? "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:bg-white"}
      style={{ color: active ? "var(--accent)" : "var(--text-hint)" }}
    >
      <Pin className="h-4 w-4" strokeWidth={2} fill={active ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
