"use client";

import { useEffect, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import { AiAssistantMessageList, type ActionRuntimeState, type UiMessage } from "./ai-assistant-message-list";
import { AiAssistantInput } from "./ai-assistant-input";
import { AiAssistantSuggestions } from "./ai-assistant-suggestions";
import type { ProposedAction, QuickSuggestion } from "@/lib/assistant/assistant-types";

export function AiAssistantPanel({
  onClose,
  messages,
  loading,
  configured,
  suggestions,
  actionStates,
  onSend,
  onConfirm,
  onCancel,
  onView,
}: {
  onClose: () => void;
  messages: UiMessage[];
  loading: boolean;
  configured: boolean;
  suggestions: QuickSuggestion[];
  actionStates: Record<string, ActionRuntimeState>;
  onSend: (text: string) => void;
  onConfirm: (action: ProposedAction) => void;
  onCancel: (action: ProposedAction) => void;
  onView: (action: ProposedAction) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div
      className="fixed bottom-2 left-2 right-2 z-[81] flex h-[78vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:left-auto md:bottom-6 md:right-6 md:h-[620px] md:max-h-[82vh] md:w-[420px]"
      style={{ border: "1px solid var(--border)" }}
      role="dialog"
      aria-label="Assistant IA Gedify"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 text-white" style={{ background: "var(--gedify-navy)" }}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg,#7C3AED,#F75C8D)" }}>
            <Sparkles className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-bold">Assistant IA Gedify</p>
            <p className="text-[10.5px] opacity-80">{configured ? "Connecté · OpenAI" : "Moteur IA non configuré"}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 transition hover:bg-white/15">
          <X className="h-4.5 w-4.5" strokeWidth={2} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3" style={{ background: "var(--bg-page)" }}>
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border bg-white p-3 text-[13px]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              Bonjour 👋 Je suis votre copilote Gedify. Je connais la page où vous êtes et je peux chercher dans vos documents (OCR, fiches IA), classer, taguer, gérer le budget et les rappels. Demandez-moi quelque chose, ou choisissez :
            </div>
            <AiAssistantSuggestions suggestions={suggestions} onPick={onSend} disabled={loading} />
          </div>
        ) : (
          <AiAssistantMessageList
            messages={messages}
            loading={loading}
            actionStates={actionStates}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onView={onView}
          />
        )}
      </div>

      {/* Suggestions persistantes (quand conversation démarrée) */}
      {messages.length > 0 ? (
        <div className="border-t px-2.5 py-2" style={{ borderColor: "var(--border)" }}>
          <AiAssistantSuggestions suggestions={suggestions.slice(0, 4)} onPick={onSend} disabled={loading} />
        </div>
      ) : null}

      <AiAssistantInput onSend={onSend} loading={loading} />
    </div>
  );
}
