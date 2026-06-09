"use client";

import { useSyncExternalStore } from "react";

export type ComposerAttachment = { documentId: number; name: string };

export type ComposerInitial = {
  to?: string;
  subject?: string;
  bodyHtml?: string;
  threadId?: string;
  inReplyTo?: string;
  /** Compte d'envoi présélectionné (réponse → boîte ayant reçu le message). */
  accountId?: string;
  /** Documents GED à joindre (récupérés côté serveur à l'envoi). */
  attachments?: ComposerAttachment[];
};

type State = { open: boolean; minimized: boolean; seq: number; initial: ComposerInitial };

let state: State = { open: false, minimized: false, seq: 0, initial: {} };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Ouvre la fenêtre « Nouveau message » (ou réponse) avec un contenu initial. */
export function openComposer(initial: ComposerInitial = {}) {
  state = { open: true, minimized: false, seq: state.seq + 1, initial };
  emit();
}

export function closeComposer() {
  state = { ...state, open: false };
  emit();
}

export function setComposerMinimized(minimized: boolean) {
  state = { ...state, minimized };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useComposer() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
