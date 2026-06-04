import type { ChatMessage, GedifyAssistantContext, ProposedAction, ProposedActionType } from "./assistant-types";
import { emptyAssistantContext } from "./assistant-types";

const ACTION_TYPES: ProposedActionType[] = [
  "assign_folder", "add_tags", "remove_tags", "set_type", "analyze",
  "create_financial_item", "validate_financial_item", "create_reminder", "draft_mail", "navigate",
];

const SPACES = new Set([
  "documents", "mails", "finances", "dossiers", "contacts", "rappels",
  "actions", "calendrier", "tableau-de-bord", "recherche", "administration", "autre",
]);

/* ────────────────────────────────────────────────────────────────────────
   Mémoire conversationnelle légère : l'historique vit côté client et est
   renvoyé à chaque requête. Ici on le valide/normalise et on normalise le
   contexte reçu (défense : ne jamais faire confiance au payload brut).
   ──────────────────────────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */

export function sanitizeHistory(raw: unknown, max = 12): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as any).role;
    const content = (m as any).content;
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
      out.push({ role, content: content.slice(0, 4000) });
    }
  }
  return out.slice(-max);
}

function asNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Normalise le contexte client en `GedifyAssistantContext` sûr. */
export function sanitizeContext(raw: unknown): GedifyAssistantContext {
  const base = emptyAssistantContext();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as any;
  return {
    ...base,
    currentRoute: asString(r.currentRoute) ?? base.currentRoute,
    currentSpace: SPACES.has(r.currentSpace) ? (r.currentSpace as GedifyAssistantContext["currentSpace"]) : base.currentSpace,
    currentView: asString(r.currentView),
    selectedDocumentIds: asNumberArray(r.selectedDocumentIds).slice(0, 500),
    activeDocumentId: Number.isFinite(Number(r.activeDocumentId)) ? Number(r.activeDocumentId) : null,
    activeMailId: asString(r.activeMailId),
    activeContactId: asString(r.activeContactId),
    activeBudgetEntryId: asString(r.activeBudgetEntryId),
    activeFolderId: asString(r.activeFolderId),
    activeTaskId: asString(r.activeTaskId),
    activeSearchQuery: asString(r.activeSearchQuery),
    activeFilters:
      r.activeFilters && typeof r.activeFilters === "object"
        ? Object.fromEntries(
            Object.entries(r.activeFilters as Record<string, unknown>)
              .filter(([, v]) => typeof v === "string")
              .slice(0, 20) as [string, string][],
          )
        : {},
    lastOpenedDocumentId: Number.isFinite(Number(r.lastOpenedDocumentId)) ? Number(r.lastOpenedDocumentId) : null,
    lastAssistantAction: asString(r.lastAssistantAction),
  };
}

/** Valide une action reçue du client avant exécution/aperçu. */
export function sanitizeAction(raw: unknown): ProposedAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as any;
  if (!ACTION_TYPES.includes(r.type)) return null;
  return {
    id: typeof r.id === "string" ? r.id : "",
    type: r.type as ProposedActionType,
    label: typeof r.label === "string" ? r.label : "",
    description: typeof r.description === "string" ? r.description : "",
    documentIds: asNumberArray(r.documentIds).slice(0, 1000),
    params: r.params && typeof r.params === "object" ? (r.params as Record<string, unknown>) : {},
    sensitive: r.sensitive === true,
    requiresConfirmation: r.requiresConfirmation !== false,
    confidencePct: Number.isFinite(Number(r.confidencePct)) ? Number(r.confidencePct) : null,
    clientSide: r.clientSide === true,
  };
}
