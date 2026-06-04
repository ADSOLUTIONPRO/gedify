"use client";

import { FileText, Loader2 } from "lucide-react";
import type { DocumentRef, ProposedAction } from "@/lib/assistant/assistant-types";
import { AiAssistantActionCard, type ActionState } from "./ai-assistant-action-card";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposedActions?: ProposedAction[];
  documentRefs?: DocumentRef[];
  error?: boolean;
};

export type ActionRuntimeState = { state: ActionState; message?: string };

export function AiAssistantMessageList({
  messages,
  loading,
  actionStates,
  onConfirm,
  onCancel,
  onView,
}: {
  messages: UiMessage[];
  loading: boolean;
  actionStates: Record<string, ActionRuntimeState>;
  onConfirm: (action: ProposedAction) => void;
  onCancel: (action: ProposedAction) => void;
  onView: (action: ProposedAction) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-3 py-2 text-[13px] text-white" style={{ background: "var(--accent)" }}>
              {m.content}
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex flex-col gap-2">
            <div
              className="max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border px-3 py-2 text-[13px]"
              style={{
                borderColor: m.error ? "#FCA5A5" : "var(--border)",
                background: m.error ? "rgba(239,68,68,0.05)" : "white",
                color: "var(--text-main)",
              }}
            >
              {m.content}
            </div>

            {m.documentRefs && m.documentRefs.length > 0 ? (
              <div className="ml-1 flex flex-col gap-0.5">
                {m.documentRefs.slice(0, 8).map((d) => (
                  <a
                    key={d.id}
                    href={`/documents/${d.id}`}
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-medium hover:underline"
                    style={{ color: "var(--gedify-navy)" }}
                  >
                    <FileText className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                    <span className="truncate">#{d.id} · {d.title}</span>
                  </a>
                ))}
                {m.documentRefs.length > 8 ? (
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>+{m.documentRefs.length - 8} autre(s)</span>
                ) : null}
              </div>
            ) : null}

            {m.proposedActions?.map((a) => (
              <AiAssistantActionCard
                key={a.id}
                action={a}
                state={actionStates[a.id]?.state ?? "idle"}
                resultMessage={actionStates[a.id]?.message}
                onConfirm={() => onConfirm(a)}
                onCancel={() => onCancel(a)}
                onView={() => onView(a)}
              />
            ))}
          </div>
        ),
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> L&apos;assistant réfléchit…
        </div>
      ) : null}
    </div>
  );
}
