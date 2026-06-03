"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

const RECURRENCES = [
  ["none", "Aucune"],
  ["daily", "Quotidien"],
  ["weekly", "Hebdomadaire"],
  ["monthly", "Mensuel"],
  ["yearly", "Annuel"],
] as const;

const PRIORITIES = [
  ["low", "Basse"],
  ["normal", "Normale"],
  ["high", "Haute"],
  ["urgent", "Urgente"],
] as const;

/** Bouton + formulaire de création de rappel (POST /api/reminders). */
export function AddReminderButton({ label = "Nouveau rappel", color = "#06B6D4" }: { label?: string; color?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", remindAt: "", recurrence: "none", priority: "normal", notes: "" });

  async function submit() {
    if (!form.title.trim() || !form.remindAt) {
      setError("Titre et date requis.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          remindAt: new Date(form.remindAt).toISOString(),
          recurrence: form.recurrence,
          priority: form.priority,
          channel: "in_app",
          notes: form.notes.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOpen(false);
      setForm({ title: "", remindAt: "", recurrence: "none", priority: "normal", notes: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-white transition hover:opacity-90" style={{ background: color }}>
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer" onClick={() => !busy && setOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl border bg-white p-5 shadow-2xl" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>Nouveau rappel</h2>
              <button type="button" onClick={() => !busy && setOpen(false)} aria-label="Fermer" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Titre" className="h-9 w-full rounded-lg border px-2.5 text-[13px] outline-none focus:border-cyan-400" style={{ borderColor: "var(--border)" }} />
              <input type="datetime-local" value={form.remindAt} onChange={(e) => setForm((s) => ({ ...s, remindAt: e.target.value }))} className="h-9 w-full rounded-lg border px-2.5 text-[13px] outline-none" style={{ borderColor: "var(--border)" }} />
              <div className="flex gap-2">
                <select value={form.recurrence} onChange={(e) => setForm((s) => ({ ...s, recurrence: e.target.value }))} className="h-9 flex-1 rounded-lg border px-2 text-[13px] outline-none" style={{ borderColor: "var(--border)" }}>
                  {RECURRENCES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))} className="h-9 w-32 rounded-lg border px-2 text-[13px] outline-none" style={{ borderColor: "var(--border)" }}>
                  {PRIORITIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Notes (optionnel)" rows={2} className="w-full rounded-lg border px-2.5 py-2 text-[13px] outline-none" style={{ borderColor: "var(--border)" }} />
            </div>
            {error ? <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--danger)" }}>{error}</p> : null}
            <div className="mt-4 flex justify-end">
              <button type="button" disabled={busy} onClick={submit} className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: color }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Créer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
