"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";

/* Connexion d'un compte CalDAV (iCloud) : Apple ID + mot de passe d'application.
   Liste les comptes connectés, permet la synchro (pull) et la déconnexion. */

type Account = { id: string; label: string; username: string; calendars: { url: string; displayName: string; color: string | null }[] };

export function CalDavConnect() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11.5px] font-bold transition hover:bg-[var(--accent-soft)]" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
        <Plus className="h-3.5 w-3.5" strokeWidth={2.2} /> Connecter iCloud
      </button>
      {open ? <CalDavModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function CalDavModal({ onClose }: { onClose: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calendar/caldav", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d: { accounts?: Account[] }) => { if (!cancelled && Array.isArray(d.accounts)) setAccounts(d.accounts); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function connect() {
    if (!username.trim() || !password) { setError("Apple ID et mot de passe d'application requis."); return; }
    setBusy(true); setError(null); setOk(null);
    try {
      const res = await fetch("/api/calendar/caldav", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ label: label.trim() || undefined, username: username.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { account?: Account; message?: string };
      if (!res.ok) throw new Error(data.message ?? `Erreur ${res.status}`);
      setOk("Compte iCloud connecté. Synchronisation…");
      // Synchro immédiate puis rechargement pour rafraîchir agendas + événements.
      if (data.account) await fetch("/api/calendar/caldav/sync", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ accountId: data.account.id }) }).catch(() => {});
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible.");
      setBusy(false);
    }
  }

  async function sync(id: string) {
    setSyncing(id); setError(null);
    try {
      await fetch("/api/calendar/caldav/sync", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ accountId: id }) });
      window.location.reload();
    } catch { setSyncing(null); }
  }

  async function disconnect(id: string) {
    if (!window.confirm("Déconnecter ce compte iCloud ?")) return;
    setBusy(true);
    try {
      await fetch(`/api/calendar/caldav?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      window.location.reload();
    } catch { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center p-2 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Connecter iCloud">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border-soft)" }}>
          <h2 className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Agendas iCloud (CalDAV)</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[var(--surface-muted)]" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" strokeWidth={2} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {accounts.length > 0 ? (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-xl border p-2.5" style={{ borderColor: "var(--border-soft)" }}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{a.label}</p>
                    <p className="truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{a.calendars.length} agenda(s)</p>
                  </div>
                  <button type="button" onClick={() => void sync(a.id)} disabled={syncing === a.id} className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-[var(--accent-soft)] disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--accent)" }} title="Synchroniser">
                    {syncing === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.85} />}
                  </button>
                  <button type="button" onClick={() => void disconnect(a.id)} className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-rose-50" style={{ borderColor: "var(--border)", color: "#E11D48" }} title="Déconnecter">
                    <Trash2 className="h-4 w-4" strokeWidth={1.85} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border-soft)", background: "var(--bg-card-soft)" }}>
            <p className="text-[12px] font-bold" style={{ color: "var(--text-main)" }}>Ajouter un compte</p>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom (optionnel)" className="h-9 w-full rounded-xl border px-3 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Apple ID (email)" autoComplete="off" className="h-9 w-full rounded-xl border px-3 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Mot de passe d'application" autoComplete="new-password" className="h-9 w-full rounded-xl border px-3 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
            <p className="text-[10.5px]" style={{ color: "var(--text-hint)" }}>Créez un mot de passe d&apos;application sur appleid.apple.com → Sécurité (la double authentification doit être activée).</p>
          </div>

          {error ? <p className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: "var(--gedify-orange-soft)", color: "var(--text-main)" }}>{error}</p> : null}
          {ok ? <p className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{ok}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3.5" style={{ borderColor: "var(--border-soft)" }}>
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-xl border px-4 text-[13.5px] font-semibold transition hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Fermer</button>
          <button type="button" onClick={() => void connect()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Connecter
          </button>
        </div>
      </div>
    </div>
  );
}
