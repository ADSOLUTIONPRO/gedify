"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";

type SyncResponse = {
  synced?: number;
  myContactsCount?: number;
  otherContactsCount?: number;
  message?: string;
  error?: string;
  errorType?: "missing_scope" | "people_api_disabled" | "token_expired" | string;
};

/**
 * Bouton de synchronisation Google Contacts (People API) avec retour d'erreur
 * explicite : scope manquant / People API désactivée / jeton expiré → message
 * clair + lien de reconnexion, plutôt qu'un échec silencieux.
 */
export function ContactsSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<{ message: string; needsReconnect: boolean } | null>(null);

  async function sync() {
    if (busy) return;
    setBusy(true);
    setOk(null);
    setErr(null);
    try {
      const res = await fetch("/api/messaging/google/contacts/sync", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as SyncResponse;
      if (res.ok) {
        setOk(`${data.synced ?? 0} contact(s) synchronisé(s).`);
        router.refresh();
      } else {
        const needsReconnect = data.errorType === "missing_scope" || data.errorType === "token_expired";
        setErr({ message: data.message ?? data.error ?? "Synchronisation impossible.", needsReconnect });
      }
    } catch {
      setErr({ message: "Synchronisation impossible (réseau).", needsReconnect: false });
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
        className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--accent)" }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" strokeWidth={2} aria-hidden="true" />}
        {busy ? "Synchronisation…" : "Synchroniser les contacts"}
      </button>

      {ok ? (
        <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--success)" }}>
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {ok}
        </p>
      ) : null}

      {err ? (
        <div className="max-w-xs rounded-lg border px-2.5 py-1.5 text-right" style={{ borderColor: "#FECACA", background: "#FEF2F2" }}>
          <p className="inline-flex items-start gap-1.5 text-[11.5px] font-semibold" style={{ color: "#B91C1C" }}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>{err.message}</span>
          </p>
          {err.needsReconnect ? (
            <Link href="/messagerie/parametres" className="mt-1 inline-block text-[11.5px] font-bold underline" style={{ color: "var(--accent)" }}>
              Reconnecter le compte Google →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
