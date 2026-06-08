"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UiMessage } from "@/components/ai-assistant/ai-assistant-message-list";

/* ────────────────────────────────────────────────────────────────────────
   Gestion client des conversations IA persistantes.
   - Source de vérité = serveur (API /api/ai/conversations).
   - localStorage ne mémorise QUE l'identifiant de la conversation active.
   - Synchro multi-onglets via BroadcastChannel + événement `storage`.
   La conversation n'est créée en base qu'au PREMIER message (pas à chaque
   montage) — un « nouveau chat » vide n'écrit rien tant qu'on n'envoie pas.
   ──────────────────────────────────────────────────────────────────────── */

const ACTIVE_KEY = "gedify.ai.activeConversationId";
const CHANNEL = "gedify-assistant";
const NEW_TITLE = "Nouveau chat";

export type ConversationSummary = {
  id: string;
  title: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  lastMessagePreview: string | null;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  metadata?: Record<string, unknown> | null;
  documentRefs?: unknown[] | null;
  error?: boolean;
};

type ConversationFull = ConversationSummary & { messages: StoredMessage[] };

type BroadcastMsg =
  | { type: "append"; conversationId: string; messages: StoredMessage[] }
  | { type: "active"; conversationId: string }
  | { type: "list-changed" };

function storedToUi(m: StoredMessage): UiMessage | null {
  if (m.role === "system") return null;
  return {
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    proposedActions: (m.metadata?.proposedActions as UiMessage["proposedActions"]) ?? undefined,
    documentRefs: (m.documentRefs as UiMessage["documentRefs"]) ?? undefined,
    error: m.error,
  };
}

export function useConversations() {
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [title, setTitle] = useState<string>(NEW_TITLE);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeIdRef = useRef<string | null>(null);
  // Synchro hors-render : le ref reflète l'id actif (setActive le met aussi à
  // jour immédiatement pour les handlers async ; cet effet couvre les autres
  // chemins de mise à jour de l'état).
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  const bcRef = useRef<BroadcastChannel | null>(null);

  const broadcast = useCallback((msg: BroadcastMsg) => {
    bcRef.current?.postMessage(msg);
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/conversations", { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { conversations?: ConversationSummary[] };
      setConversations(data.conversations ?? []);
    } catch {
      /* hors-ligne : la liste reste celle en mémoire */
    }
  }, []);

  /** Définit la conversation active (état + localStorage + diffusion). */
  const setActive = useCallback((id: string | null, opts: { broadcast?: boolean } = {}) => {
    setActiveIdState(id);
    activeIdRef.current = id;
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* localStorage indisponible */
    }
    if (id && opts.broadcast) broadcast({ type: "active", conversationId: id });
  }, [broadcast]);

  const applyConversation = useCallback((conv: ConversationFull) => {
    setActive(conv.id);
    setTitle(conv.title);
    setMessages(conv.messages.map(storedToUi).filter((m): m is UiMessage => m !== null));
  }, [setActive]);

  const loadConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) return false;
      const data = (await res.json()) as { conversation?: ConversationFull };
      if (!data.conversation) return false;
      applyConversation(data.conversation);
      return true;
    } catch {
      return false;
    }
  }, [applyConversation]);

  /** Ouvre une conversation (depuis l'historique) + diffuse aux autres onglets. */
  const openConversation = useCallback(async (id: string) => {
    const ok = await loadConversation(id);
    if (ok) broadcast({ type: "active", conversationId: id });
  }, [loadConversation, broadcast]);

  /** Nouveau chat vide (création différée au 1er message). */
  const newChat = useCallback(() => {
    setActive(null, { broadcast: false });
    setTitle(NEW_TITLE);
    setMessages([]);
  }, [setActive]);

  /** Garantit une conversation persistée (création paresseuse). Renvoie l'id. */
  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (activeIdRef.current) return activeIdRef.current;
    try {
      const res = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: NEW_TITLE }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { conversation?: ConversationFull };
      if (!data.conversation) return null;
      setActive(data.conversation.id, { broadcast: true });
      setTitle(data.conversation.title);
      void refreshList();
      return data.conversation.id;
    } catch {
      return null;
    }
  }, [setActive, refreshList]);

  /** Ajout local (optimiste) avec anti-doublon par id. */
  const appendLocal = useCallback((msgs: UiMessage[]) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const add = msgs.filter((m) => !seen.has(m.id));
      return add.length ? [...prev, ...add] : prev;
    });
  }, []);

  /** Persiste des messages côté serveur + diffuse aux autres onglets. */
  const persistMessages = useCallback(async (conversationId: string, stored: StoredMessage[]) => {
    if (stored.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: stored }),
      });
      if (res.ok) {
        const data = (await res.json()) as { conversation?: ConversationFull };
        if (data.conversation && data.conversation.id === activeIdRef.current) setTitle(data.conversation.title);
        broadcast({ type: "append", conversationId, messages: stored });
        void refreshList();
      }
    } catch {
      /* échec réseau : le message reste affiché localement, ré-essayable */
    } finally {
      setSaving(false);
    }
  }, [broadcast, refreshList]);

  const rename = useCallback(async (id: string, newTitle: string) => {
    await fetch(`/api/ai/conversations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ title: newTitle }),
    }).catch(() => {});
    if (id === activeIdRef.current) setTitle(newTitle.trim() || NEW_TITLE);
    broadcast({ type: "list-changed" });
    void refreshList();
  }, [broadcast, refreshList]);

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    await fetch(`/api/ai/conversations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ status: archived ? "archived" : "active" }),
    }).catch(() => {});
    if (archived && id === activeIdRef.current) newChat();
    broadcast({ type: "list-changed" });
    void refreshList();
  }, [broadcast, refreshList, newChat]);

  const remove = useCallback(async (id: string) => {
    await fetch(`/api/ai/conversations/${id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
    if (id === activeIdRef.current) newChat();
    broadcast({ type: "list-changed" });
    void refreshList();
  }, [broadcast, refreshList, newChat]);

  /* ── Init (montage unique) + synchro multi-onglets ──────────────────────── */
  useEffect(() => {
    let cancelled = false;

    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (e: MessageEvent<BroadcastMsg>) => {
        const data = e.data;
        if (data.type === "append" && data.conversationId === activeIdRef.current) {
          appendLocal(data.messages.map(storedToUi).filter((m): m is UiMessage => m !== null));
          void refreshList();
        } else if (data.type === "active" && data.conversationId !== activeIdRef.current) {
          void loadConversation(data.conversationId);
        } else if (data.type === "list-changed") {
          void refreshList();
        }
      };
      bcRef.current = bc;
    }

    function onStorage(e: StorageEvent) {
      if (e.key === ACTIVE_KEY && e.newValue && e.newValue !== activeIdRef.current) {
        void loadConversation(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);

    (async () => {
      await refreshList();
      let stored: string | null = null;
      try { stored = localStorage.getItem(ACTIVE_KEY); } catch { /* ignore */ }
      if (stored) {
        const ok = await loadConversation(stored);
        if (!ok && !cancelled) {
          try { localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
        }
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      bcRef.current?.close();
      bcRef.current = null;
    };
    // Montage unique : les callbacks sont stables (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    activeId, title, messages, conversations, ready, saving,
    setMessages, appendLocal, ensureConversation, persistMessages,
    newChat, openConversation, rename, setArchived, remove, refreshList,
  };
}
