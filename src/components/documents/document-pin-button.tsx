"use client";

import { Pin } from "lucide-react";
import { usePins } from "@/components/documents/pins-provider";

/**
 * Bouton « Épingler » un document (par utilisateur), DISTINCT du favori. Les
 * documents épinglés apparaissent dans le widget « Documents épinglés » du
 * tableau de bord. N'ouvre/ne sélectionne jamais la carte.
 */
export function DocumentPinButton({ documentId, className }: { documentId: number; className?: string }) {
  const pins = usePins();
  if (!pins) return null;
  const active = pins.has(documentId);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); pins.toggle(documentId); }}
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
