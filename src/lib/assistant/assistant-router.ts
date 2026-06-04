import "server-only";

import type { ChatMessage, ChatResult, GedifyAssistantContext, ProposedActionType } from "./assistant-types";
import { buildSystemPrompt } from "./assistant-prompts";
import { TOOL_SCHEMAS, runTool, type ToolRunContext } from "./assistant-tools";
import { runAssistantLoop, isAssistantConfigured } from "./assistant-execution";
import { getAssistantPermissions, isActionAllowed } from "./assistant-permissions";
import { getAssistantSettings } from "./assistant-settings";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Mappe un nom d'outil « propose_* » vers le type d'action correspondant. */
const PROPOSE_TO_ACTION: Record<string, ProposedActionType> = {
  propose_assign_folder: "assign_folder",
  propose_add_tags: "add_tags",
  propose_set_type: "set_type",
  propose_analyze: "analyze",
  propose_create_financial_item: "create_financial_item",
  propose_create_reminder: "create_reminder",
  propose_complete_task: "complete_task",
  propose_create_folder: "create_folder",
  propose_apply_filter: "apply_filter",
  propose_draft_mail: "draft_mail",
  propose_navigate: "navigate",
};

/**
 * Point d'entrée serveur de l'assistant : orchestre prompt → boucle d'outils
 * OpenAI → actions proposées, en respectant les permissions.
 */
export async function handleAssistantChat(opts: {
  message: string;
  history: ChatMessage[];
  context: GedifyAssistantContext;
}): Promise<ChatResult> {
  if (!isAssistantConfigured()) {
    return {
      reply:
        "Le moteur IA n'est pas configuré. Renseignez AI_CLOUD_API_KEY (ou OPENAI_API_KEY) — et éventuellement AI_ASSISTANT_MODEL — pour activer l'assistant.",
      intent: null,
      proposedActions: [],
      requiresConfirmation: false,
      usedTools: [],
      documentRefs: [],
      autoApplySafe: false,
      error: "not_configured",
    };
  }

  const perms = getAssistantPermissions();
  const settings = await getAssistantSettings();

  // N'expose au modèle que les outils autorisés (lecture + actions permises).
  // Si les actions sont désactivées (réglage), on retire tous les outils « propose_* ».
  const tools = TOOL_SCHEMAS.filter((t) => {
    const name = t.function.name;
    const actionType = PROPOSE_TO_ACTION[name];
    if (!actionType) return true;
    if (!settings.actionsEnabled) return false;
    return isActionAllowed(actionType, perms);
  });

  const rc: ToolRunContext = { ctx: opts.context, proposals: [], refs: [] };

  try {
    const { reply, usedTools } = await runAssistantLoop({
      system: await buildSystemPrompt(opts.context),
      history: opts.history,
      userMessage: opts.message,
      tools: tools as any[],
      execTool: (name, args) => runTool(name, args, rc),
    });

    // Filet de sécurité : ne renvoie que des actions autorisées par les réglages/permissions.
    const proposedActions = rc.proposals
      .filter((a) => settings.actionsEnabled && isActionAllowed(a.type, perms))
      .map((a) =>
        // En mode auto, les actions sûres (non sensibles, ≤ 1 document) ne demandent plus confirmation.
        settings.autoApplySafe && !a.sensitive && a.documentIds.length <= 1
          ? { ...a, requiresConfirmation: false }
          : a,
      );
    const requiresConfirmation = proposedActions.some((a) => a.requiresConfirmation);

    return {
      reply,
      intent: usedTools[0] ?? null,
      proposedActions,
      requiresConfirmation,
      usedTools,
      documentRefs: rc.refs.slice(0, 30),
      autoApplySafe: settings.autoApplySafe,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      reply: `Désolé, une erreur est survenue : ${message}`,
      intent: null,
      proposedActions: [],
      requiresConfirmation: false,
      usedTools: [],
      documentRefs: [],
      autoApplySafe: false,
      error: message,
    };
  }
}
