"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Download, History, Loader2, MessageSquarePlus, MoreVertical, Pencil, Save, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { AiAssistantMessageList, type ActionRuntimeState, type UiMessage } from "./ai-assistant-message-list";
import { AiAssistantInput } from "./ai-assistant-input";
import { AiAssistantSuggestions } from "./ai-assistant-suggestions";
import { ConversationHistory } from "./conversation-history";
import type { ConversationSummary } from "@/lib/assistant/use-conversations";
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
  conversationTitle,
  activeConversationId,
  conversations,
  saving,
  onNewChat,
  onOpenConversation,
  onRenameConversation,
  onArchiveConversation,
  onDeleteConversation,
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
  conversationTitle: string;
  activeConversationId: string | null;
  conversations: ConversationSummary[];
  saving: boolean;
  onNewChat: () => void;
  onOpenConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onArchiveConversation: (id: string, archived: boolean) => void;
  onDeleteConversation: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  function exportConversation() {
    setHeaderMenu(false);
    if (messages.length === 0) return;
    const lines = [
      `# ${conversationTitle || "Conversation"}`,
      `_Exporté le ${new Date().toLocaleString("fr-FR")}_`,
      "",
      ...messages.map((m) => `**${m.role === "user" ? "Vous" : "Assistant"} :**\n\n${m.content}\n`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (conversationTitle || "conversation").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50) || "conversation";
    a.href = url; a.download = `${slug}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function commitRename() {
    setRenaming(false);
    if (activeConversationId && renameValue.trim()) onRenameConversation(activeConversationId, renameValue.trim());
  }

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
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg,#7C3AED,#F75C8D)" }}>
            <Sparkles className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <div className="min-w-0 leading-tight">
            {renaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
                onBlur={commitRename}
                className="w-full rounded-md bg-white/15 px-1.5 py-0.5 text-[13px] font-bold text-white outline-none ring-1 ring-white/40"
              />
            ) : (
              <p className="truncate text-[13px] font-bold" title={conversationTitle}>{conversationTitle || "Assistant IA Gedify"}</p>
            )}
            <p className="flex items-center gap-1 text-[10.5px] opacity-80">
              {saving ? (
                <><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Enregistrement…</>
              ) : activeConversationId ? (
                <><Save className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> Conversation enregistrée</>
              ) : (
                <>{configured ? "Connecté · OpenAI" : "Moteur IA non configuré"}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => { setShowHistory(false); onNewChat(); }}
            aria-label="Nouveau chat"
            title="Nouveau chat"
            className="rounded-lg p-1.5 transition hover:bg-white/15"
          >
            <MessageSquarePlus className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            aria-label="Historique des conversations"
            title="Historique"
            className={`rounded-lg p-1.5 transition hover:bg-white/15 ${showHistory ? "bg-white/15" : ""}`}
          >
            <History className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            aria-label="Réglages de l'assistant"
            className={`rounded-lg p-1.5 transition hover:bg-white/15 ${showSettings ? "bg-white/15" : ""}`}
          >
            <Settings2 className="h-4 w-4" strokeWidth={2} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setHeaderMenu((s) => !s)}
              aria-label="Plus d'options"
              aria-haspopup="menu"
              aria-expanded={headerMenu}
              className={`rounded-lg p-1.5 transition hover:bg-white/15 ${headerMenu ? "bg-white/15" : ""}`}
            >
              <MoreVertical className="h-4 w-4" strokeWidth={2} />
            </button>
            {headerMenu ? (
              <>
                <button type="button" aria-hidden="true" tabIndex={-1} onClick={() => setHeaderMenu(false)} className="fixed inset-0 z-[1] cursor-default" />
                <div role="menu" className="absolute right-0 top-full z-[2] mt-1 w-52 overflow-hidden rounded-xl border bg-white py-1 text-left shadow-xl" style={{ borderColor: "var(--border)" }}>
                  <HeaderMenuItem icon={Pencil} label="Renommer" disabled={!activeConversationId} onClick={() => { setHeaderMenu(false); setRenameValue(conversationTitle); setRenaming(true); }} />
                  <HeaderMenuItem icon={Download} label="Exporter (Markdown)" disabled={messages.length === 0} onClick={exportConversation} />
                  <HeaderMenuItem icon={Archive} label="Archiver" disabled={!activeConversationId} onClick={() => { setHeaderMenu(false); if (activeConversationId) onArchiveConversation(activeConversationId, true); }} />
                  <div className="my-1 border-t" style={{ borderColor: "var(--border-soft)" }} />
                  <HeaderMenuItem icon={Trash2} danger label="Supprimer" disabled={!activeConversationId} onClick={() => { setHeaderMenu(false); if (activeConversationId && window.confirm("Supprimer définitivement cette conversation ?")) onDeleteConversation(activeConversationId); }} />
                </div>
              </>
            ) : null}
          </div>
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

      {showHistory ? (
        <ConversationHistory
          conversations={conversations}
          activeId={activeConversationId}
          onOpen={(id) => { onOpenConversation(id); setShowHistory(false); }}
          onRename={onRenameConversation}
          onArchive={onArchiveConversation}
          onDelete={onDeleteConversation}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

function HeaderMenuItem({ icon: Icon, label, onClick, disabled, danger }: { icon: typeof Pencil; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] font-semibold transition hover:bg-[var(--bg-card-soft)] disabled:opacity-40"
      style={{ color: danger ? "#DC2626" : "var(--text-main)" }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} style={{ color: danger ? "#DC2626" : "var(--text-muted)" }} aria-hidden="true" /> {label}
    </button>
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
