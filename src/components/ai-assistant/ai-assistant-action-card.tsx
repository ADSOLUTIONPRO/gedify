"use client";

import {
  ArrowRight,
  Bell,
  CheckCircle2,
  FolderInput,
  Mail,
  Sparkles,
  Tag,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ProposedAction, ProposedActionType } from "@/lib/assistant/assistant-types";
import { AiAssistantProgress } from "./ai-assistant-progress";

export type ActionState = "idle" | "running" | "done" | "error";

const ICONS: Record<ProposedActionType, LucideIcon> = {
  assign_folder: FolderInput,
  add_tags: Tag,
  remove_tags: Tag,
  set_type: Tag,
  analyze: Sparkles,
  create_financial_item: Wallet,
  validate_financial_item: Wallet,
  create_reminder: Bell,
  draft_mail: Mail,
  navigate: ArrowRight,
};

export function AiAssistantActionCard({
  action,
  state,
  resultMessage,
  onConfirm,
  onCancel,
  onView,
}: {
  action: ProposedAction;
  state: ActionState;
  resultMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onView: () => void;
}) {
  const Icon = ICONS[action.type];
  const tags = Array.isArray(action.params.tags) ? (action.params.tags as string[]) : [];

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border-strong)", background: "var(--bg-card-soft)" }}>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "rgba(124,58,237,0.12)" }}>
          <Icon className="h-4 w-4" style={{ color: "#7C3AED" }} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Action proposée{action.sensitive ? " · sensible" : ""}
          </p>
          <p className="truncate text-[13px] font-bold" style={{ color: "var(--gedify-navy)" }}>{action.label}</p>
        </div>
      </div>

      <p className="mt-2 text-[12px]" style={{ color: "var(--text-main)" }}>{action.description}</p>

      {tags.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.map((t, i) => (
            <span key={i} className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: "#7C3AED", color: "#fff" }}>{t}</span>
          ))}
        </div>
      ) : null}

      {action.confidencePct != null ? (
        <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          Confiance : <strong>{action.confidencePct} %</strong>
        </p>
      ) : null}

      {state === "running" ? (
        <div className="mt-2.5">
          <AiAssistantProgress label="Exécution en cours…" detail={action.label} />
        </div>
      ) : state === "done" ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#16A34A" }}>
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> {resultMessage ?? "Action effectuée."}
        </p>
      ) : state === "error" ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-rose-700">
          <TriangleAlert className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> {resultMessage ?? "Échec de l'action."}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[12px] font-bold text-white transition hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            {action.clientSide && action.type === "navigate" ? "Ouvrir" : "Confirmer"}
          </button>
          {action.documentIds.length > 0 ? (
            <button
              type="button"
              onClick={onView}
              className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-[12px] font-bold transition hover:bg-white"
              style={{ borderColor: "var(--border-strong)", color: "var(--gedify-navy)" }}
            >
              Voir les documents
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[12px] font-semibold transition hover:bg-white"
            style={{ color: "var(--text-muted)" }}
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
