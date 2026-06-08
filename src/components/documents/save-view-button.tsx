"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Check, Loader2 } from "lucide-react";

const IGNORED = new Set(["page", "taille"]);

/** Enregistre les filtres Documents courants comme « vue » réouvrable. */
export function SaveViewButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function save() {
    const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    for (const k of IGNORED) sp.delete(k);
    const query = sp.toString();
    const name = window.prompt("Nom de la vue à enregistrer :", "");
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/document-views", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ name: name.trim(), query }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      setTimeout(() => setDone(false), 1800);
      router.refresh();
    } catch {
      window.alert("Enregistrement de la vue impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void save()}
      disabled={busy}
      title="Enregistrer les filtres actuels comme vue"
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50"
      style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : done ? <Check className="h-4 w-4" style={{ color: "var(--gedify-green)" }} strokeWidth={2.25} aria-hidden="true" /> : <BookmarkPlus className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />}
      {done ? "Vue enregistrée" : "Enregistrer la vue"}
    </button>
  );
}
