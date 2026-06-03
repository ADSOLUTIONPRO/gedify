"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Clock, Loader2, Repeat } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { ReminderBucketLabel, ReminderRecord } from "@/lib/actions/reminder-store";
import { formatDateTime } from "@/lib/format";

const RECURRENCE_LABEL: Record<string, string> = {
  none: "Ponctuel",
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  yearly: "Annuel",
  custom: "Personnalisé",
};

/** Carte de rappel (bucket pré-calculé côté serveur pour respecter purity). */
export function ReminderCard({ reminder, bucket }: { reminder: ReminderRecord; bucket: ReminderBucketLabel }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const done = reminder.status === "done" || reminder.status === "cancelled";

  async function complete() {
    setBusy(true);
    try {
      await fetch(`/api/reminders/${reminder.id}/complete`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-3" style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}>
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(6,182,212,0.10)", color: "#06B6D4" }}>
        <Bell className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <span className={`block truncate text-[13.5px] font-bold ${done ? "line-through opacity-60" : ""}`} style={{ color: "var(--text-main)" }}>{reminder.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> {formatDateTime(reminder.remindAt)}</span>
          {reminder.recurrence !== "none" ? <span className="inline-flex items-center gap-1"><Repeat className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> {RECURRENCE_LABEL[reminder.recurrence]}</span> : null}
        </span>
      </div>
      <StatusPill tone={bucket.tone} dot>{bucket.label}</StatusPill>
      {!done ? (
        <button type="button" disabled={busy} onClick={complete} aria-label="Marquer fait" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600" style={{ borderColor: "var(--border)" }}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  );
}
