"use client";

import { Loader2, X } from "lucide-react";
import type { BulkSelectHook } from "@/hooks/use-bulk-select";

export type BulkAction = {
  label: string;
  icon?: React.ElementType;
  tone?: "default" | "danger" | "success" | "warning";
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

type Props = {
  bulk: BulkSelectHook;
  actions: BulkAction[];
  entityLabel?: string;
};

const TONE_STYLES: Record<NonNullable<BulkAction["tone"]>, { border: string; color: string; hover: string }> = {
  default: { border: "var(--border)", color: "var(--text-main)", hover: "hover:bg-slate-50" },
  danger: { border: "#FCA5A5", color: "#DC2626", hover: "hover:bg-rose-50" },
  success: { border: "#6EE7B7", color: "#059669", hover: "hover:bg-emerald-50" },
  warning: { border: "#FDE68A", color: "#D97706", hover: "hover:bg-amber-50" },
};

export function BulkActionsToolbar({ bulk, actions, entityLabel = "élément" }: Props) {
  if (bulk.isNoneSelected) return null;

  const label =
    bulk.selectedCount === 1
      ? `1 ${entityLabel} sélectionné`
      : `${bulk.selectedCount} ${entityLabel}s sélectionnés`;

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5"
      style={{ borderColor: "var(--blue-600)", background: "rgba(11,92,255,0.05)" }}
      role="toolbar"
      aria-label="Actions groupées"
    >
      <span className="text-[13px] font-bold" style={{ color: "var(--blue-600)" }}>
        {label}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => {
          const tone = action.tone ?? "default";
          const styles = TONE_STYLES[tone];
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled ?? action.loading}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold transition ${styles.hover} disabled:opacity-50`}
              style={{ borderColor: styles.border, color: styles.color }}
            >
              {action.loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : Icon ? (
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : null}
              {action.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => bulk.clearAll()}
        className="ml-auto flex items-center gap-1 text-[12px] transition hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
        aria-label="Désélectionner tout"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        Désélectionner
      </button>
    </div>
  );
}
