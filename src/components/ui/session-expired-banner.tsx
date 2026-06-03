"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * Écoute les réponses 401 de l'application et affiche un bandeau
 * "Session expirée" avec un lien vers /login.
 *
 * Utilise un CustomEvent "ged:unauthorized" émis par les composants clients
 * quand ils reçoivent un 401 des routes API.
 */
export function SessionExpiredBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handle() { setVisible(true); }
    window.addEventListener("ged:unauthorized", handle);
    return () => window.removeEventListener("ged:unauthorized", handle);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl"
      style={{
        background: "#FFFBEB",
        borderColor: "#FDE68A",
        color: "#92400E",
      }}
      role="alert"
    >
      <ShieldAlert className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      <div className="flex-1">
        <p className="text-[13px] font-bold">Session expirée</p>
        <p className="text-[12px]">Veuillez vous reconnecter pour continuer.</p>
      </div>
      <Link
        href={`/login?next=${typeof window !== "undefined" ? encodeURIComponent(window.location.pathname) : "/"}`}
        className="rounded-xl px-3 py-1.5 text-[12.5px] font-bold text-white transition hover:opacity-90"
        style={{ background: "var(--blue-600)" }}
      >
        Se connecter
      </Link>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="text-[12px] underline"
        style={{ color: "#92400E" }}
      >
        ×
      </button>
    </div>
  );
}

/** Émet l'événement depuis n'importe quel composant client quand un 401 est reçu. */
export function emitUnauthorized() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ged:unauthorized"));
  }
}
