"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";

type ManualContact = {
  resourceName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
};

const inputCls = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

/** Création + suppression de contacts manuels. */
export function ManualContactsPanel({ contacts }: { contacts: ManualContact[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ displayName: "", email: "", phone: "", organization: "" });
  const [busy, setBusy] = useState(false);
  const [delBusy, setDelBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!form.displayName.trim() && !form.email.trim()) { setError("Nom ou email requis."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Échec."); }
      setForm({ displayName: "", email: "", phone: "", organization: "" });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec.");
    } finally { setBusy(false); }
  }

  async function remove(resourceName: string) {
    setDelBusy(resourceName);
    try {
      const res = await fetch(`/api/contacts?resourceName=${encodeURIComponent(resourceName)}`, { method: "DELETE", credentials: "include" });
      if (res.ok) router.refresh();
    } finally { setDelBusy(null); }
  }

  return (
    <div className="space-y-3">
      {open ? (
        <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} placeholder="Nom" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            <input className={inputCls} placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input className={inputCls} placeholder="Téléphone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <input className={inputCls} placeholder="Société" value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} />
          </div>
          {error ? <p className="text-[12px] font-semibold text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void create()} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: "var(--blue-600)" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer
            </button>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-lg border px-3 text-[13px] font-semibold text-slate-600" style={{ borderColor: "var(--border)" }}>Annuler</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>
          <UserPlus className="h-4 w-4" /> Nouveau contact manuel
        </button>
      )}

      {contacts.length === 0 ? (
        <p className="px-1 py-2 text-[13px]" style={{ color: "var(--text-muted)" }}>Aucun contact manuel.</p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {contacts.map((c) => (
            <li key={c.resourceName} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold" style={{ color: "var(--text-main)" }}>{c.displayName}</p>
                <p className="truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{[c.email, c.phone, c.organization].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <button type="button" disabled={delBusy === c.resourceName} onClick={() => void remove(c.resourceName)} aria-label="Supprimer" className="flex h-8 w-8 items-center justify-center rounded-lg border transition hover:bg-rose-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
                {delBusy === c.resourceName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Bouton : créer un contact manuel à partir d'un correspondant GEDify. */
export function ContactFromCorrespondentButton({ name, correspondentId }: { name: string; correspondentId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, correspondentId }),
      });
      if (res.ok) { setDone(true); router.refresh(); }
    } finally { setBusy(false); }
  }

  if (done) return <span className="text-[11.5px] font-semibold text-emerald-600">Contact créé</span>;
  return (
    <button type="button" disabled={busy} onClick={() => void create()} className="inline-flex items-center gap-1 text-[11.5px] font-semibold underline disabled:opacity-50" style={{ color: "#0B5CFF" }}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />} Créer un contact
    </button>
  );
}
