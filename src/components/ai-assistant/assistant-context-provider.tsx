"use client";

import { useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  emptyAssistantContext,
  type AssistantSpace,
  type GedifyAssistantContext,
} from "@/lib/assistant/assistant-types";

/* ────────────────────────────────────────────────────────────────────────
   Contexte applicatif global de l'assistant, implémenté en STORE EXTERNE
   (useSyncExternalStore) plutôt qu'en React Context : c'est le pattern
   recommandé pour qu'une page synchronise sa sélection / son élément actif
   depuis un effet, sans déclencher de re-rendus en cascade.

   - Les pages appellent `setAssistantOverrides({...})` (fonction simple).
   - Le widget lit l'ensemble via `useAssistantContext()` : route + espace +
     document actif dérivés de l'URL, fusionnés avec les overrides poussés.
   Ne collecte QUE le nécessaire — aucune donnée OCR ici.
   ──────────────────────────────────────────────────────────────────────── */

let overrides: Partial<GedifyAssistantContext> = {};
const EMPTY: Partial<GedifyAssistantContext> = {};
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return overrides;
}
function getServerSnapshot() {
  return EMPTY;
}

/** Pousse la sélection / l'élément actif de la page courante dans le contexte. */
export function setAssistantOverrides(patch: Partial<GedifyAssistantContext>) {
  overrides = { ...overrides, ...patch };
  emit();
}

/** Réinitialise les overrides (ex. au démontage d'une page). */
export function clearAssistantOverrides() {
  overrides = {};
  emit();
}

function spaceFromPath(p: string): AssistantSpace {
  if (p.startsWith("/documents")) return "documents";
  if (p.startsWith("/mails") || p.startsWith("/messagerie") || p.startsWith("/emails")) return "mails";
  if (p.startsWith("/finances") || p.startsWith("/budget")) return "finances";
  if (p.startsWith("/organiser") || p.startsWith("/dossiers") || p.startsWith("/projets")) return "dossiers";
  if (p.startsWith("/contacts")) return "contacts";
  if (p.startsWith("/rappels")) return "rappels";
  if (p.startsWith("/actions")) return "actions";
  if (p.startsWith("/calendrier")) return "calendrier";
  if (p.startsWith("/administration")) return "administration";
  if (p.startsWith("/recherche")) return "recherche";
  if (p === "/" || p.startsWith("/accueil") || p.startsWith("/dashboard") || p.startsWith("/tableau")) return "tableau-de-bord";
  return "autre";
}

export function useAssistantContext(): GedifyAssistantContext {
  const pathname = usePathname() ?? "/";
  const ov = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo<GedifyAssistantContext>(() => {
    const base = emptyAssistantContext(pathname);
    base.currentSpace = spaceFromPath(pathname);
    const dm = pathname.match(/^\/documents\/(\d+)/);
    if (dm) base.activeDocumentId = Number(dm[1]);
    const fm = pathname.match(/^\/(?:organiser\/dossiers|dossiers|projets)\/([^/]+)/);
    if (fm) base.activeFolderId = fm[1];
    const tm = pathname.match(/^\/messagerie\/thread\/([^/]+)/);
    if (tm) base.activeMailId = decodeURIComponent(tm[1]);

    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      base.currentView = sp.get("view");
      base.activeSearchQuery = sp.get("query");
      const filters: Record<string, string> = {};
      for (const k of ["etat", "correspondent", "document_type", "tag", "tab", "kind", "status"]) {
        const v = sp.get(k);
        if (v) filters[k] = v;
      }
      base.activeFilters = filters;
    }

    return { ...base, ...ov };
  }, [pathname, ov]);
}
