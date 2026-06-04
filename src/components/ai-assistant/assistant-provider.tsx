"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import type { ProposedAction, QuickSuggestion } from "@/lib/assistant/assistant-types";
import { useAssistantContext } from "./assistant-context-provider";
import { AiAssistantButton } from "./ai-assistant-button";
import { AiAssistantPanel } from "./ai-assistant-panel";
import type { ActionRuntimeState, UiMessage } from "./ai-assistant-message-list";

/* ────────────────────────────────────────────────────────────────────────
   Orchestrateur du chat assistant : état, envoi vers /api/assistant/chat,
   confirmation / exécution des actions (serveur ou client). Monté globalement.
   ──────────────────────────────────────────────────────────────────────── */

const DEFAULT_SUGGESTIONS: QuickSuggestion[] = [
  { label: "Analyser les non classés", prompt: "Analyse tous les documents non classés et propose un classement." },
  { label: "Factures à payer", prompt: "Trouve les factures et dépenses à payer cette semaine." },
  { label: "Documents à vérifier", prompt: "Montre-moi les documents avec une analyse IA faible ou à vérifier." },
  { label: "Recherche OCR", prompt: "Cherche les documents où il est écrit « mise en demeure »." },
  { label: "Documents sans dossier", prompt: "Trouve les documents qui ne sont rangés dans aucun dossier." },
];

type AssistantSettingsState = { actionsEnabled: boolean; autoApplySafe: boolean };

let counter = 0;
const uid = () => `m${Date.now()}_${counter++}`;

export function AssistantProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AssistantWidget />
    </>
  );
}

function AssistantWidget() {
  const router = useRouter();
  const context = useAssistantContext();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [actionStates, setActionStates] = useState<Record<string, ActionRuntimeState>>({});
  const [settings, setSettings] = useState<AssistantSettingsState | null>(null);
  const confirmRef = useRef<(a: ProposedAction) => void>(() => {});

  const setActionState = useCallback((id: string, state: ActionRuntimeState["state"], message?: string) => {
    setActionStates((prev) => ({ ...prev, [id]: { state, message } }));
  }, []);

  // Charge les réglages à la première ouverture (setState dans un callback async → OK).
  useEffect(() => {
    if (open && !settings) {
      fetch("/api/assistant/settings", { credentials: "include" })
        .then((r) => r.json())
        .then((s) => setSettings({ actionsEnabled: s?.actionsEnabled !== false, autoApplySafe: s?.autoApplySafe === true }))
        .catch(() => setSettings({ actionsEnabled: true, autoApplySafe: false }));
    }
  }, [open, settings]);

  const toggleSetting = useCallback(async (key: keyof AssistantSettingsState, value: boolean) => {
    setSettings((prev) => ({ actionsEnabled: true, autoApplySafe: false, ...(prev ?? {}), [key]: value }));
    await fetch("/api/assistant/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {});
  }, []);

  const suggestions = suggestionsForSpace(context.currentSpace, context.selectedDocumentIds.length > 0);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { id: uid(), role: "user", content: trimmed }]);
      setLoading(true);
      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: trimmed, history, context }),
        });
        const data = await res.json();
        if (data?.error === "not_configured") setConfigured(false);
        const actions: ProposedAction[] = Array.isArray(data?.proposedActions) ? data.proposedActions : [];
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: typeof data?.reply === "string" ? data.reply : "Réponse vide.",
            proposedActions: actions,
            documentRefs: Array.isArray(data?.documentRefs) ? data.documentRefs : [],
          },
        ]);
        // Mode auto : exécute immédiatement les actions sûres (sans confirmation).
        if (data?.autoApplySafe) {
          for (const a of actions) if (a.requiresConfirmation === false) confirmRef.current(a);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: "Erreur réseau : impossible de joindre l'assistant.", error: true },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, context],
  );

  const runClientAction = useCallback(
    (action: ProposedAction) => {
      if (action.type === "apply_filter") {
        router.push(String(action.params.url ?? "/documents"));
        setActionState(action.id, "done", "Filtre appliqué.");
        setOpen(false);
        return;
      }
      if (action.type === "navigate") {
        router.push(navTarget(action));
        setActionState(action.id, "done", "Ouvert.");
        setOpen(false);
        return;
      }
      if (action.type === "draft_mail") {
        openComposer({
          to: (action.params.to as string | null) || undefined,
          subject: (action.params.subject as string) ?? "",
          bodyHtml: ((action.params.body as string) ?? "").replace(/\n/g, "<br>"),
          threadId: (action.params.threadId as string | null) || undefined,
          inReplyTo: (action.params.inReplyTo as string | null) || undefined,
          attachments: action.documentIds.map((id) => ({ documentId: id, name: `Document ${id}` })),
        });
        setActionState(action.id, "done", "Brouillon ouvert dans le compositeur.");
      }
    },
    [router, setActionState],
  );

  const confirm = useCallback(
    async (action: ProposedAction) => {
      if (action.clientSide) {
        runClientAction(action);
        return;
      }
      setActionState(action.id, "running");
      try {
        const res = await fetch("/api/assistant/actions/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        setActionState(action.id, data?.ok ? "done" : "error", data?.message ?? data?.error ?? "Terminé.");
        if (data?.ok) router.refresh();
      } catch {
        setActionState(action.id, "error", "Erreur réseau.");
      }
    },
    [router, runClientAction, setActionState],
  );
  useEffect(() => {
    confirmRef.current = confirm;
  }, [confirm]);

  const cancel = useCallback((action: ProposedAction) => setActionState(action.id, "done", "Annulé."), [setActionState]);

  const view = useCallback(
    (action: ProposedAction) => {
      const first = action.documentIds[0];
      if (first) {
        router.push(`/documents/${first}`);
        setOpen(false);
      }
    },
    [router],
  );

  return (
    <>
      <AiAssistantButton open={open} onClick={() => setOpen((o) => !o)} />
      {open ? (
        <AiAssistantPanel
          onClose={() => setOpen(false)}
          messages={messages}
          loading={loading}
          configured={configured}
          suggestions={suggestions}
          actionStates={actionStates}
          settings={settings}
          onToggleSetting={toggleSetting}
          onSend={send}
          onConfirm={confirm}
          onCancel={cancel}
          onView={view}
        />
      ) : null}
    </>
  );
}

function navTarget(action: ProposedAction): string {
  const id = action.params.id ? String(action.params.id) : "";
  switch (action.params.target) {
    case "document": return id ? `/documents/${id}` : "/documents";
    case "folder": return id ? `/organiser/dossiers/${id}` : "/organiser/dossiers";
    case "finances": return "/finances";
    case "mails": return "/emails";
    case "reminders": return "/rappels";
    default: return "/documents";
  }
}

function suggestionsForSpace(space: string, hasSelection: boolean): QuickSuggestion[] {
  if (space === "finances")
    return [
      { label: "Dettes en retard", prompt: "Liste les dettes et paiements en retard." },
      { label: "Dépenses à venir", prompt: "Montre les dépenses à venir sur 30 jours." },
      ...DEFAULT_SUGGESTIONS.slice(0, 2),
    ];
  if (space === "documents" && hasSelection)
    return [
      { label: "Analyser la sélection", prompt: "Analyse les documents sélectionnés et applique les classements sûrs." },
      { label: "Classer la sélection", prompt: "Classe les documents sélectionnés dans le bon dossier." },
      ...DEFAULT_SUGGESTIONS.slice(0, 2),
    ];
  if (space === "dossiers")
    return [
      { label: "Ranger ce dossier", prompt: "Range les documents non classés dans le dossier actif." },
      ...DEFAULT_SUGGESTIONS.slice(0, 3),
    ];
  if (space === "mails")
    return [
      { label: "Docs liés à ce mail", prompt: "Trouve les documents GED liés à ce mail." },
      { label: "Préparer une réponse", prompt: "Prépare un brouillon de réponse à ce mail." },
      { label: "Mails avec PJ", prompt: "Cherche les mails récents qui ont une pièce jointe." },
      ...DEFAULT_SUGGESTIONS.slice(0, 1),
    ];
  if (space === "contacts")
    return [
      { label: "Docs de ce contact", prompt: "Trouve les documents liés au contact actif." },
      { label: "Préparer un mail", prompt: "Prépare un mail pour ce contact avec les documents sélectionnés." },
      ...DEFAULT_SUGGESTIONS.slice(0, 2),
    ];
  if (space === "actions")
    return [
      { label: "Mes tâches à faire", prompt: "Liste mes tâches et actions à faire." },
      { label: "Docs de cette tâche", prompt: "Montre les documents liés à la tâche active." },
      { label: "Marquer faite", prompt: "Marque la tâche active comme terminée." },
      ...DEFAULT_SUGGESTIONS.slice(0, 1),
    ];
  return DEFAULT_SUGGESTIONS;
}
