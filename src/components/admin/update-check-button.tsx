"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

/** « Vérifier maintenant » : interroge GHCR/manifeste (sans rien installer). */
export function UpdateCheckButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    try {
      await fetch("/api/admin/updates/check", { method: "POST", credentials: "include" });
      router.refresh();
    } catch {
      /* l'erreur est reflétée dans l'état au prochain chargement */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void check()}
      disabled={busy}
      className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      style={{ background: "var(--accent)" }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />}
      Vérifier maintenant
    </button>
  );
}
