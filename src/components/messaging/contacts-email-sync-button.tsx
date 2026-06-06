"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Inbox, Loader2 } from "lucide-react";

type SyncResponse = {
  detected?: number;
  created?: number;
  skippedDuplicates?: number;
  message?: string;
  error?: string;
};

/**
 * Détecte les contacts depuis les emails synchronisés (expéditeurs/destinataires).
 * Crée des contacts `imap_email` sans doublonner les adresses déjà connues.
 */
export function ContactsEmailSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sync() {
    if (busy) return;
    setBusy(true);
    setOk(null);
    setErr(null);
    try {
      const res = await fetch("/api/contacts/sync/email", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as SyncResponse;
      if (res.ok) {
        setOk(`${data.created ?? 0} nouveau(x) contact(s) · ${data.detected ?? 0} détecté(s).`);
        router.refresh();
      } else {
        setErr(data.message ?? data.error ?? "Détection impossible.");
      }
    } catch {
      setErr("Détection impossible (réseau).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => void sync()}
        disabled={busy}
        className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-60"
        style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Inbox className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />}
        {busy ? "Analyse des emails…" : "Détecter depuis les emails"}
      </button>
      {ok ? (
        <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--success)" }}>
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> {ok}
        </p>
      ) : null}
      {err ? (
        <p className="inline-flex items-start gap-1.5 text-[11.5px] font-semibold" style={{ color: "#B91C1C" }}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" /> {err}
        </p>
      ) : null}
    </div>
  );
}
