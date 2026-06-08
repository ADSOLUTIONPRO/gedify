"use client";

import { useState } from "react";
import { Loader2, Pin, PinOff } from "lucide-react";
import { toast } from "@/components/ui/toast";

/**
 * Épingle/désépingle un dossier ou projet au tableau de bord (par utilisateur,
 * persisté en base via /api/pinned-items). Libellé adaptatif.
 */
export function FolderPinButton({
  entityId,
  entityType = "folder",
  initialPinned,
  className,
  iconOnly = false,
}: {
  entityId: string;
  entityType?: "folder" | "project";
  initialPinned: boolean;
  className?: string;
  /** Variante compacte : icône seule (listes / tuiles). */
  iconOnly?: boolean;
}) {
  const [pinned, setPinned] = useState(initialPinned);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !pinned;
    setPinned(next); // optimiste
    try {
      if (next) {
        const res = await fetch("/api/pinned-items", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ entityType, entityId }),
        });
        if (!res.ok) throw new Error();
        toast("Dossier épinglé sur l'accueil", "success");
      } else {
        const res = await fetch(`/api/pinned-items/${entityId}`, { method: "DELETE", credentials: "include" });
        if (!res.ok) throw new Error();
        toast("Dossier retiré de l'accueil", "default");
      }
    } catch {
      setPinned(!next); // rollback
      toast("Action impossible. Réessayez.", "error");
    } finally {
      setBusy(false);
    }
  }

  const icon = busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : pinned ? <PinOff className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <Pin className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />;
  const title = pinned ? "Retirer du tableau de bord" : "Épingler au tableau de bord";

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={pinned}
        aria-label={title}
        title={title}
        className={className ?? "flex h-8 w-8 items-center justify-center rounded-lg border bg-white transition hover:bg-[var(--accent-soft)] disabled:opacity-50"}
        style={{ borderColor: "var(--border)", color: pinned ? "var(--accent)" : "var(--text-muted)" }}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={pinned}
      title={title}
      className={className ?? "inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-50"}
    >
      {icon}
      {pinned ? "Retirer du tableau de bord" : "Épingler"}
    </button>
  );
}
