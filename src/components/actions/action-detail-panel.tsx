"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Check, Clock, Loader2, Mail, PenLine, Trash2 } from "lucide-react";
import { ActionStatusBadge } from "@/components/actions/action-status-badge";
import { ActionPriorityBadge } from "@/components/actions/action-priority-badge";
import { ActionLinkedItems } from "@/components/actions/action-linked-items";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { ACTION_TYPE_LABELS, type ActionItem } from "@/lib/actions/types";
import { formatDate, formatDateTime } from "@/lib/format";

/** Fiche détail d'une action : infos, liens GED, actions serveur, historique. */
export function ActionDetailPanel({ action }: { action: ActionItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [postponeDate, setPostponeDate] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const done = action.status === "done" || action.status === "cancelled";

  async function call(url: string, body?: unknown) {
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
      await fetch(`/api/actions/${action.id}`, { method: "DELETE" });
      router.push("/actions");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      {/* Contenu principal */}
      <div className="space-y-4">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <ActionStatusBadge status={action.status} />
            <ActionPriorityBadge priority={action.priority} />
            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(100,116,139,0.10)", color: "var(--text-muted)" }}>{ACTION_TYPE_LABELS[action.type]}</span>
            {action.createdFrom === "ai" ? <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(124,58,237,0.10)", color: "#7C3AED" }}>IA</span> : null}
          </div>
          <h1 className="mt-2 text-[20px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>{action.title}</h1>
          {action.description ? <p className="mt-1 text-[13.5px]" style={{ color: "var(--text-muted)" }}>{action.description}</p> : null}
          {action.dueDate ? <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: action.status === "overdue" ? "var(--danger)" : "var(--text-muted)" }}><Clock className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Échéance : {formatDate(action.dueDate)}</p> : null}
        </div>

        {/* Historique */}
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Historique</p>
          {action.history.length === 0 ? (
            <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucun évènement.</p>
          ) : (
            <ul className="space-y-1.5">
              {action.history.slice().reverse().map((h, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-[12px]">
                  <span style={{ color: "var(--text-main)" }}>{h.message}</span>
                  <span className="shrink-0" style={{ color: "var(--text-muted)" }}>{formatDateTime(h.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Panneau actions + liens */}
      <aside className="space-y-4">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Actions</p>
          <div className="space-y-1.5">
            {!done ? (
              <button type="button" disabled={busy} onClick={() => call(`/api/actions/${action.id}/complete`)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: "#16A34A" }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" strokeWidth={2} aria-hidden="true" />} Marquer terminé
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={() => call(`/api/actions/${action.id}/create-reminder`)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Créer un rappel
            </button>
            <div className="flex gap-1.5">
              <input type="date" value={postponeDate} onChange={(e) => setPostponeDate(e.target.value)} className="h-9 flex-1 rounded-lg border px-2 text-[12.5px] outline-none" style={{ borderColor: "var(--border)" }} />
              <button type="button" disabled={busy || !postponeDate} onClick={() => call(`/api/actions/${action.id}/postpone`, { dueDate: postponeDate })} className="inline-flex h-9 items-center rounded-lg border px-3 text-[12.5px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Reporter</button>
            </div>
            <Link href="/redaction/nouveau" className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <PenLine className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Générer un courrier
            </Link>
            <Link href="/messagerie" className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Préparer un email
            </Link>
            <button type="button" onClick={() => setConfirmDelete(true)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition hover:bg-rose-50" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Supprimer
            </button>
            <ConfirmDeleteDialog
              isOpen={confirmDelete}
              onClose={() => setConfirmDelete(false)}
              onConfirm={remove}
              loading={busy}
              title={`Supprimer « ${action.title} » ?`}
              description="Cette action sera définitivement supprimée. Cette opération est irréversible."
            />
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Éléments liés</p>
          <ActionLinkedItems action={action} />
        </div>
      </aside>
    </div>
  );
}
