"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";

type Priority = "low" | "normal" | "high" | "urgent";
type Reminder = {
  id: string;
  title: string;
  remindAt: string;
  status: "scheduled" | "done" | "cancelled";
  priority: Priority;
  documentId: number | null;
};

const PRIORITY_META: Record<Priority, { label: string; bg: string; color: string }> = {
  low: { label: "Basse", bg: "#F4F6F8", color: "#475569" },
  normal: { label: "Normale", bg: "#ECF3FF", color: "#2563EB" },
  high: { label: "Haute", bg: "#FFF4E5", color: "#B45309" },
  urgent: { label: "Urgente", bg: "#FEE2E2", color: "#B91C1C" },
};

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Rappels liés au document (`/api/reminders?documentId=`) : liste, ajout,
 * « marquer comme fait », suppression. Réutilise le store reminders existant.
 */
export function DocumentReminders({ documentId }: { documentId: number }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState(() => toDateTimeLocal(new Date(Date.now() + 86_400_000).toISOString()));
  const [priority, setPriority] = useState<Priority>("normal");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reminders?documentId=${documentId}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: Reminder[] }) => {
        if (!cancelled) setReminders(d.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  async function add() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: t, remindAt: new Date(remindAt).toISOString(), priority, documentId }),
      });
      if (res.ok) {
        const { item } = (await res.json()) as { item: Reminder };
        setReminders((prev) => [...prev, item].sort((a, b) => a.remindAt.localeCompare(b.remindAt)));
        setTitle("");
        setAdding(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function complete(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/reminders/${id}/complete`, { method: "POST", credentials: "include" });
      if (res.ok) setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, status: "done" } : r)));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) setReminders((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Chargement…
        </p>
      ) : reminders.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucun rappel pour ce document.</p>
      ) : (
        <ul className="space-y-1.5">
          {reminders.map((r) => {
            const p = PRIORITY_META[r.priority] ?? PRIORITY_META.normal;
            const done = r.status === "done";
            return (
              <li key={r.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(31,41,55,0.03)", border: "1px solid var(--border)" }}>
                <Bell className="h-3.5 w-3.5 shrink-0" style={{ color: done ? "#15803D" : "var(--accent)" }} strokeWidth={1.75} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold" style={{ color: "var(--text-main)", textDecoration: done ? "line-through" : undefined }}>{r.title}</p>
                  <p className="text-[10.5px]" style={{ color: "var(--text-hint)" }}>{formatDateTime(r.remindAt)}</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: p.bg, color: p.color }}>{p.label}</span>
                {!done ? (
                  <button type="button" onClick={() => void complete(r.id)} disabled={busy} aria-label="Marquer comme fait" className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white" style={{ color: "#15803D" }}>
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#DCFCE7", color: "#15803D" }}>Fait</span>
                )}
                <button type="button" onClick={() => void remove(r.id)} disabled={busy} aria-label="Supprimer" className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white" style={{ color: "var(--text-hint)" }}>
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder="Intitulé du rappel…"
            className="h-8 w-full rounded-lg border px-2.5 text-[12.5px] outline-none focus:border-[var(--accent)]"
            style={{ borderColor: "var(--border)" }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} className="h-8 rounded-lg border px-2 text-[12px]" style={{ borderColor: "var(--border)" }} />
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="h-8 rounded-lg border px-2 text-[12px]" style={{ borderColor: "var(--border)" }}>
              <option value="low">Basse</option>
              <option value="normal">Normale</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => { setAdding(false); setTitle(""); }} className="inline-flex h-8 items-center rounded-[20px] border-[1.5px] px-3 text-[12px] font-bold" style={{ borderColor: "#374151", color: "#374151" }}>Annuler</button>
              <button type="button" onClick={() => void add()} disabled={busy || !title.trim()} className="inline-flex h-8 items-center gap-1 rounded-[20px] px-3.5 text-[12px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
                <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />Ajouter
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed text-[12.5px] font-bold transition hover:bg-[#FCFAF7]"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Ajouter un rappel
        </button>
      )}
    </div>
  );
}
