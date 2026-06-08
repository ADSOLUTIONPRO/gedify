"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

/** Bouton « Synchroniser Google » : importe les événements Google dans le socle. */
export function GoogleSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; report?: { imported: number; updated: number }; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      const r = data.report;
      setMsg({ ok: true, text: r ? `${r.imported} importé(s), ${r.updated} à jour` : "Synchronisé" });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Synchro impossible." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void sync()}
        disabled={busy}
        title="Importer les événements Google Agenda"
        className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50"
        style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />}
        Synchroniser Google
      </button>
      {msg ? <span className="text-[11.5px] font-semibold" style={{ color: msg.ok ? "var(--gedify-green)" : "var(--gedify-orange)" }}>{msg.text}</span> : null}
    </div>
  );
}
