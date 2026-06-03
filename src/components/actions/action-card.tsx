"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Clock, FileText, Loader2, Sparkles, Wallet } from "lucide-react";
import { ActionPriorityBadge } from "@/components/actions/action-priority-badge";
import { ACTION_TYPE_LABELS, type ActionItem, type ActionPriority } from "@/lib/actions/types";
import { formatDate } from "@/lib/format";

const PRIORITY_BORDER: Record<ActionPriority, string> = {
  urgent: "#EF4444",
  high: "#F97316",
  normal: "#0B5CFF",
  low: "#94A3B8",
};

/** Carte d'action (kanban + listes). Actions rapides : terminer, ouvrir détail. */
export function ActionCard({ action, compact = false }: { action: ActionItem; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const done = action.status === "done" || action.status === "cancelled";

  async function complete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await fetch(`/api/actions/${action.id}/complete`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Link
      href={`/actions/${action.id}`}
      className="group block rounded-xl border bg-white p-3 transition hover:-translate-y-0.5"
      style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)", borderLeft: `3px solid ${PRIORITY_BORDER[action.priority]}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`min-w-0 text-[13.5px] font-bold ${done ? "line-through opacity-60" : ""}`} style={{ color: "var(--text-main)" }}>
          {action.title}
        </span>
        {!done ? (
          <button type="button" onClick={complete} disabled={busy} aria-label="Marquer terminé" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-slate-400 opacity-0 transition hover:bg-emerald-50 hover:text-emerald-600 group-hover:opacity-100" style={{ borderColor: "var(--border)" }}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
          </button>
        ) : null}
      </div>

      {action.description && !compact ? (
        <p className="mt-1 line-clamp-2 text-[12px]" style={{ color: "var(--text-muted)" }}>{action.description}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ActionPriorityBadge priority={action.priority} />
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(100,116,139,0.10)", color: "var(--text-muted)" }}>
          {ACTION_TYPE_LABELS[action.type]}
        </span>
        {action.createdFrom === "ai" ? (
          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(124,58,237,0.10)", color: "#7C3AED" }}>
            <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> IA
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {action.dueDate ? (
          <span className="inline-flex items-center gap-1" style={{ color: action.status === "overdue" ? "var(--danger)" : "var(--text-muted)" }}>
            <Clock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> {formatDate(action.dueDate)}
          </span>
        ) : null}
        {action.documentIds.length > 0 ? <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> {action.documentIds.length}</span> : null}
        {action.budgetItemId ? <span className="inline-flex items-center gap-1"><Wallet className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> budget</span> : null}
        {action.amount ? <span className="font-semibold" style={{ color: "var(--text-main)" }}>{action.amount.toLocaleString("fr-FR")} {action.currency ?? "€"}</span> : null}
      </div>
    </Link>
  );
}
