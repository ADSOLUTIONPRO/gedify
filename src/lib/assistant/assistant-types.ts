/**
 * Types partagés de l'assistant IA Gedify (client + serveur).
 * ⚠️ Pas de "server-only" ici : importé aussi par les composants client.
 */

/** Espaces fonctionnels de Gedify, déduits de la route courante. */
export type AssistantSpace =
  | "documents"
  | "mails"
  | "finances"
  | "dossiers"
  | "contacts"
  | "rappels"
  | "actions"
  | "calendrier"
  | "tableau-de-bord"
  | "recherche"
  | "administration"
  | "autre";

/**
 * Contexte applicatif courant transmis à chaque message du chat.
 * Collecté côté client par le store de contexte assistant — uniquement le nécessaire.
 */
export type GedifyAssistantContext = {
  currentRoute: string;
  currentSpace: AssistantSpace;
  currentView: string | null; // grid | table | detail | fiche-ia | ...
  selectedDocumentIds: number[];
  activeDocumentId: number | null;
  activeMailId: string | null;
  activeContactId: string | null;
  activeBudgetEntryId: string | null;
  activeFolderId: string | null;
  activeTaskId: string | null;
  activeSearchQuery: string | null;
  activeFilters: Record<string, string>;
  lastOpenedDocumentId: number | null;
  lastAssistantAction: string | null;
};

export function emptyAssistantContext(route = "/"): GedifyAssistantContext {
  return {
    currentRoute: route,
    currentSpace: "autre",
    currentView: null,
    selectedDocumentIds: [],
    activeDocumentId: null,
    activeMailId: null,
    activeContactId: null,
    activeBudgetEntryId: null,
    activeFolderId: null,
    activeTaskId: null,
    activeSearchQuery: null,
    activeFilters: {},
    lastOpenedDocumentId: null,
    lastAssistantAction: null,
  };
}

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

/** Type d'action que l'assistant peut proposer puis exécuter après confirmation. */
export type ProposedActionType =
  | "assign_folder"
  | "add_tags"
  | "remove_tags"
  | "set_type"
  | "analyze"
  | "create_financial_item"
  | "validate_financial_item"
  | "create_reminder"
  | "complete_task"
  | "draft_mail"
  | "navigate";

/** Référence légère d'un document (pour transparence / anti-hallucination). */
export type DocumentRef = { id: number; title: string };

/**
 * Action structurée affichée sous forme de carte dans le chat. Les params
 * suffisent à l'exécuter via /api/assistant/actions/execute (sans état serveur).
 */
export type ProposedAction = {
  id: string;
  type: ProposedActionType;
  label: string;
  description: string;
  documentIds: number[];
  params: Record<string, unknown>;
  /** Action sensible / groupée → confirmation obligatoire. */
  sensitive: boolean;
  requiresConfirmation: boolean;
  confidencePct: number | null;
  /** Exécutée dans le navigateur (navigation, ouverture du compositeur mail). */
  clientSide: boolean;
};

/** Réponse du chat assistant. */
export type ChatResult = {
  reply: string;
  intent: string | null;
  proposedActions: ProposedAction[];
  requiresConfirmation: boolean;
  usedTools: string[];
  documentRefs: DocumentRef[];
  error?: string;
};

/** Résultat d'exécution d'une action confirmée. */
export type ExecuteResult = {
  ok: boolean;
  message: string;
  affected: number;
  error?: string;
};

/** Suggestion rapide (chip) affichée au démarrage / en bas du chat. */
export type QuickSuggestion = { label: string; prompt: string };
