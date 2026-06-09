"use client";

import { useSyncExternalStore } from "react";

/* ────────────────────────────────────────────────────────────────────────
   Signal d'ouverture du panneau Assistant IA, depuis n'importe où (ex. le
   bloc « Actions rapides » du tableau de bord). Implémenté en store externe
   minimal : un compteur incrémental. Le widget assistant (AssistantWidget)
   observe ce signal et ouvre son panneau quand il change.
   Préremplir le document actif se fait via setAssistantOverrides().
   ──────────────────────────────────────────────────────────────────────── */

let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Demande l'ouverture du panneau de l'assistant IA. */
export function requestOpenAssistant() {
  seq += 1;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return seq;
}
function getServerSnapshot() {
  return 0;
}

/** Signal incrémental : sa valeur change à chaque demande d'ouverture. */
export function useAssistantOpenSignal() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
