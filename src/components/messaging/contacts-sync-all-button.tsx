"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

type SourceResult =
  | { ok: true; synced?: number; detected?: number; created?: number }
  | { ok: false; errorType?: string; message?: string };

type AllResponse = {
  ok?: boolean;
  google?: SourceResult;
  email?: SourceResult;
  totalSynced?: number;
};

const RECONNECT = new Set(["missing_scope", "token_expired", "people_api_disabled"]);

/** « Tout synchroniser » : Google People + détection emails en un appel. */
export function ContactsSyncAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AllResponse | null>(null);

  async function sync() {
    if (busy) return;
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch("/api/contacts/sync/all", { method: "POST", credentials: "include" });
      const data = (await r.json().catch(() => ({}))) as AllResponse;
      setRes(data);
      router.refresh();
    } catch {
      setRes({ ok: false, google: { ok: false, message: "Réseau indisponible." } });
    } finally {
      setBusy(false);
    }
  }

  const googleErr = res?.google && res.google.ok === false ? res.google : null;
  const emailErr = res?.email && res.email.ok === false ? res.email : null;
  const needsReconnect = googleErr?.errorType ? RECONNECT.has(googleErr.errorType) : false;

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
        {busy ? "Synchronisation…" : "Tout synchroniser"}
      </button>

      {res && (res.google?.ok || res.email?.ok) ? (
        <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--success)" }}>
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {res.google?.ok ? `Google : ${res.google.synced ?? 0}` : null}
          {res.google?.ok && res.email?.ok ? " · " : null}
          {res.email?.ok ? `Emails : ${res.email.created ?? 0} créé(s)` : null}
        </p>
      ) : null}

      {googleErr || emailErr ? (
        <div className="max-w-xs rounded-lg border px-2.5 py-1.5 text-right" style={{ borderColor: "#FECACA", background: "#FEF2F2" }}>
          {googleErr ? (
            <p className="inline-flex items-start gap-1.5 text-[11.5px] font-semibold" style={{ color: "#B91C1C" }}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span>Google : {googleErr.message}</span>
            </p>
          ) : null}
          {emailErr ? (
            <p className="mt-0.5 text-[11.5px] font-semibold" style={{ color: "#B91C1C" }}>Emails : {emailErr.message}</p>
          ) : null}
          {needsReconnect ? (
            <Link href="/messagerie/parametres-emails" className="mt-1 inline-block text-[11.5px] font-bold underline" style={{ color: "var(--accent)" }}>
              Reconnecter le compte Google →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
