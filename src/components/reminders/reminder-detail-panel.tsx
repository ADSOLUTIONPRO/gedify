"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Check, FileText, Loader2, Trash2, Wallet, Zap } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { formatDateTime } from "@/lib/format";
import type { ReminderRecord } from "@/lib/actions/reminder-store";

/** Fiche détail d'un rappel : infos, liens, actions serveur. */
export function ReminderDetailPanel({ reminder }: { reminder: ReminderRecord }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const done = reminder.status === "done" || reminder.status === "cancelled";

  async function post(url: string, body?: unknown) {
    setBusy(true);
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/reminders/${reminder.id}`, { method: "DELETE" });
      router.push("/rappels");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(6,182,212,0.10)", color: "#06B6D4" }}>
          <Bell className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="mt-3 text-[20px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>{reminder.title}</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>Déclenchement : {formatDateTime(reminder.remindAt)}</p>
        {reminder.notes ? <p className="mt-2 text-[13px]" style={{ color: "var(--text-muted)" }}>{reminder.notes}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          <span className="rounded-md border px-2 py-0.5" style={{ borderColor: "var(--border)" }}>Récurrence : {reminder.recurrence}</span>
          <span className="rounded-md border px-2 py-0.5" style={{ borderColor: "var(--border)" }}>Canal : {reminder.channel}</span>
          <span className="rounded-md border px-2 py-0.5" style={{ borderColor: "var(--border)" }}>Priorité : {reminder.priority}</span>
        </div>
        <div className="mt-3 space-y-1">
          {reminder.actionId ? <Link href={`/actions/${reminder.actionId}`} className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12.5px] font-medium" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}><Zap className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Action liée</Link> : null}
          {reminder.documentId != null ? <Link href={`/documents/${reminder.documentId}`} className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12.5px] font-medium" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}><FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Document lié</Link> : null}
          {reminder.financialItemId ? <Link href="/finances" className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12.5px] font-medium" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}><Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Élément financier lié</Link> : null}
        </div>
      </div>

      <aside className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Actions</p>
        <div className="space-y-1.5">
          {!done ? (
            <button type="button" disabled={busy} onClick={() => post(`/api/reminders/${reminder.id}/complete`)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: "#16A34A" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />} Marquer fait
            </button>
          ) : null}
          <div className="flex gap-1.5">
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 flex-1 rounded-lg border px-2 text-[12px] outline-none" style={{ borderColor: "var(--border)" }} />
            <button type="button" disabled={busy || !date} onClick={() => post(`/api/reminders/${reminder.id}/postpone`, { remindAt: new Date(date).toISOString() })} className="inline-flex h-9 items-center rounded-lg border px-3 text-[12.5px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Reporter</button>
          </div>
          <button type="button" onClick={() => setConfirmDelete(true)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition hover:bg-rose-50" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
            <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Supprimer
          </button>
          <ConfirmDeleteDialog
            isOpen={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={remove}
            loading={busy}
            title={`Supprimer « ${reminder.title} » ?`}
            description="Ce rappel sera définitivement supprimé. Cette opération est irréversible."
          />
        </div>
      </aside>
    </div>
  );
}
