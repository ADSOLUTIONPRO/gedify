"use client";

import { useEffect, useRef, useState } from "react";
import { Settings2, Sparkles, X } from "lucide-react";
import { AiAssistantMessageList, type ActionRuntimeState, type UiMessage } from "./ai-assistant-message-list";
import { AiAssistantInput } from "./ai-assistant-input";
import { AiAssistantSuggestions } from "./ai-assistant-suggestions";
import type { ProposedAction, QuickSuggestion } from "@/lib/assistant/assistant-types";

type AssistantSettingsState = { actionsEnabled: boolean; autoApplySafe: boolean };

export function AiAssistantPanel({
  onClose,
  messages,
  loading,
  configured,
  suggestions,
  actionStates,
  settings,
  onToggleSetting,
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
  settings: AssistantSettingsState | null;
  onToggleSetting: (key: keyof AssistantSettingsState, value: boolean) => void;
  onSend: (text: string) => void;
  onConfirm: (action: ProposedAction) => void;
  onCancel: (action: ProposedAction) => void;
  onView: (action: ProposedAction) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);

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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            aria-label="Réglages de l'assistant"
            className={`rounded-lg p-1.5 transition hover:bg-white/15 ${showSettings ? "bg-white/15" : ""}`}
          >
            <Settings2 className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 transition hover:bg-white/15">
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Réglages */}
      {showSettings ? (
        <div className="border-b px-3.5 py-3" style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }}>
          <SettingRow
            label="Autoriser les actions"
            hint="Si désactivé, l'assistant se limite à chercher et expliquer."
            checked={settings?.actionsEnabled !== false}
            onChange={(v) => onToggleSetting("actionsEnabled", v)}
          />
          <SettingRow
            label="Exécuter les actions sûres automatiquement"
            hint="Les actions non sensibles sur 1 document s'appliquent sans confirmation."
            checked={settings?.autoApplySafe === true}
            onChange={(v) => onToggleSetting("autoApplySafe", v)}
          />
        </div>
      ) : null}

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

function SettingRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{label}</span>
        <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
    </label>
  );
}
