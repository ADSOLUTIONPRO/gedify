import "server-only";

import type { ProposedActionType } from "./assistant-types";

/**
 * Permissions de l'assistant. Gedify est mono-utilisateur (le compte admin
 * créé à l'installation), donc tout est autorisé par défaut — mais la couche
 * existe pour brider l'assistant via variables d'environnement et reste le
 * point unique où durcir les droits plus tard (multi-utilisateurs).
 */
export type AssistantPermissions = {
  canReadDocuments: boolean;
  canWriteDocuments: boolean;
  canRunAiAnalysis: boolean;
  canModifyFinance: boolean;
  canDeleteDocuments: boolean;
  canManageFolders: boolean;
  canCreateReminders: boolean;
  canManageTasks: boolean;
  canDraftMail: boolean;
  /** Mode lecture seule global : aucune action d'écriture autorisée. */
  readOnly: boolean;
};

function envFalse(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "false" || v === "0";
}

export function getAssistantPermissions(): AssistantPermissions {
  // ASSISTANT_READ_ONLY=true → l'assistant ne fait que chercher / expliquer.
  const readOnly = process.env.ASSISTANT_READ_ONLY?.trim().toLowerCase() === "true";
  return {
    canReadDocuments: true,
    canWriteDocuments: !readOnly && !envFalse("ASSISTANT_CAN_WRITE"),
    canRunAiAnalysis: !readOnly && !envFalse("ASSISTANT_CAN_ANALYZE"),
    canModifyFinance: !readOnly && !envFalse("ASSISTANT_CAN_FINANCE"),
    // Suppression désactivée par défaut (action destructive) — opt-in explicite.
    canDeleteDocuments: !readOnly && process.env.ASSISTANT_CAN_DELETE?.trim().toLowerCase() === "true",
    canManageFolders: !readOnly && !envFalse("ASSISTANT_CAN_FOLDERS"),
    canCreateReminders: !readOnly && !envFalse("ASSISTANT_CAN_REMINDERS"),
    canManageTasks: !readOnly && !envFalse("ASSISTANT_CAN_TASKS"),
    canDraftMail: !readOnly && !envFalse("ASSISTANT_CAN_MAIL"),
    readOnly,
  };
}

/** Permission requise pour exécuter un type d'action donné. */
export function permissionForAction(type: ProposedActionType): keyof AssistantPermissions {
  switch (type) {
    case "assign_folder":
      return "canManageFolders";
    case "add_tags":
    case "remove_tags":
    case "set_type":
      return "canWriteDocuments";
    case "analyze":
      return "canRunAiAnalysis";
    case "create_financial_item":
    case "validate_financial_item":
      return "canModifyFinance";
    case "create_reminder":
      return "canCreateReminders";
    case "complete_task":
      return "canManageTasks";
    case "draft_mail":
      return "canDraftMail";
    case "navigate":
      return "canReadDocuments";
  }
}

export function isActionAllowed(
  type: ProposedActionType,
  perms: AssistantPermissions,
): boolean {
  return perms[permissionForAction(type)] === true;
}
