"use client";

import { Sparkles, X } from "lucide-react";

/**
 * Bouton flottant d'ouverture de l'assistant (bas-droite, toutes pages).
 * Décalé vers le haut sur mobile pour ne pas gêner la navigation basse.
 */
export function AiAssistantButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Fermer l'assistant IA" : "Ouvrir l'assistant IA Gedify"}
      className="fixed right-4 bottom-[84px] z-[80] inline-flex h-14 items-center gap-2 rounded-full px-5 text-sm font-bold text-white shadow-xl transition hover:scale-[1.03] active:scale-95 md:right-6 md:bottom-6"
      style={{
        background: "linear-gradient(135deg, #7C3AED 0%, #F75C8D 100%)",
        boxShadow: "0 10px 30px -8px rgba(124,58,237,0.55)",
      }}
    >
      {open ? (
        <X className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
      ) : (
        <Sparkles className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{open ? "Fermer" : "Assistant IA"}</span>
    </button>
  );
}
