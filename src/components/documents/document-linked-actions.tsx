"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarPlus, Check, ListChecks, Loader2, Plus, Wallet } from "lucide-react";
import { ACTION_STATUS_LABELS, ACTION_TYPE_LABELS, type ActionItem, type ActionType } from "@/lib/actions/types";
import { formatDate } from "@/lib/format";

const TYPE_OPTIONS: ActionType[] = [
  "to-verify", "to-pay", "to-reply", "to-sign", "to-send", "to-follow-up",
  "to-classify", "to-call", "to-prepare", "to-declare", "to-archive", "to-keep", "to-forward", "to-contest",
];

/**
 * Bloc « Actions liées » : liste les actions rattachées au document
 * (`GET /api/actions?documentId`), permet d'en créer une (`POST /api/actions`
 * avec `documentIds`), et propose des raccourcis vers rappel / budget /
 * calendrier (l'espace s'ouvre avec le document en paramètre).
 */
export function DocumentLinkedActions({ documentId }: { documentId: number }) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActionType>("to-verify");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const res = await fetch(`/api/actions?documentId=${documentId}`, { credentials: "include" });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      /* liste indisponible */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/actions?documentId=${documentId}`, { credentials: "include" });
        const data = await res.json();
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [documentId]);

  async function create() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, type, priority: "normal", status: "todo", dueDate: due || null, documentIds: [documentId], createdFrom: "manual" }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      setDue("");
      setType("to-verify");
      setCreating(false);
      await reload();
    } catch {
      setError("Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[20px] border bg-white" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <h3 className="flex items-center gap-2 text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>
          <ListChecks className="h-4 w-4" style={{ color: "var(--text-muted)" }} strokeWidth={2} aria-hidden="true" />
          Actions liées
        </h3>
        {!creating ? (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex h-8 items-center gap-1.5 rounded-[20px] px-3 text-[12px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />Nouvelle
          </button>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        {creating ? (
          <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Intitulé de l'action" className="h-9 w-full rounded-lg border px-3 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }} />
            <div className="grid grid-cols-2 gap-2">
              <select value={type} onChange={(e) => setType(e.target.value as ActionType)} className="h-9 w-full rounded-lg border px-2 text-[12.5px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{ACTION_TYPE_LABELS[t]}</option>)}
              </select>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-9 w-full rounded-lg border px-2 text-[12.5px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-main)" }} />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setCreating(false); setTitle(""); setDue(""); }} className="inline-flex h-8 items-center rounded-[20px] border-[1.5px] px-3 text-[12px] font-bold" style={{ borderColor: "#374151", color: "#374151" }}>Annuler</button>
              <button type="button" onClick={() => void create()} disabled={busy || !title.trim()} className="inline-flex h-8 items-center gap-1 rounded-[20px] px-3.5 text-[12px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
                <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />Créer
              </button>
            </div>
            {error ? <p className="text-[12px] font-semibold" style={{ color: "var(--danger)" }}>{error}</p> : null}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Chargement...
          </div>
        ) : items.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune action liée à ce document.</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(31,41,55,0.03)", border: "1px solid var(--border)" }}>
                <span className="min-w-0">
                  <Link href={`/actions/${a.id}`} className="block truncate text-[12.5px] font-semibold hover:underline" style={{ color: "var(--text-main)" }}>{a.title}</Link>
                  <span className="text-[11px]" style={{ color: "var(--text-hint)" }}>
                    {ACTION_TYPE_LABELS[a.type]}{a.dueDate ? ` · ${formatDate(a.dueDate)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#F1F5F9", color: "#475569" }}>{ACTION_STATUS_LABELS[a.status]}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Raccourcis vers les autres éléments liés */}
        <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-hint)" }}>Créer un élément lié</p>
          <div className="grid grid-cols-3 gap-1.5">
            <Link href={`/rappels?document=${documentId}`} className="flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <Bell className="h-4 w-4" style={{ color: "var(--text-muted)" }} strokeWidth={1.75} aria-hidden="true" />Rappel
            </Link>
            <Link href={`/finances?document=${documentId}`} className="flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <Wallet className="h-4 w-4" style={{ color: "var(--text-muted)" }} strokeWidth={1.75} aria-hidden="true" />Budget
            </Link>
            <Link href={`/calendrier?document=${documentId}`} className="flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-semibold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <CalendarPlus className="h-4 w-4" style={{ color: "var(--text-muted)" }} strokeWidth={1.75} aria-hidden="true" />Calendrier
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
