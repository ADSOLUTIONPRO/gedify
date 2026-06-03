import "server-only";

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getAiDataDir, getBudgetDataDir, getActionsDataDir } from "@/lib/budget/storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResetOptions = {
  resetAiHistory?: boolean;
  resetDetectedInfos?: boolean;
  resetEntitySuggestions?: boolean;
  resetCorrectionMemory?: boolean;
  resetBudgetDrafts?: boolean;
  resetActionDrafts?: boolean;
  resetProcessingLogs?: boolean;
  resetMockData?: boolean;
  preservePaperlessDocuments?: boolean;
  preservePaperlessTaxonomies?: boolean;
  preserveSettings?: boolean;
};

export type ResetResult = {
  ok: true;
  deleted: {
    aiAnalyses: number;
    detectedInfos: number;
    entitySuggestions: number;
    correctionMemory: number;
    budgetDrafts: number;
    actionDrafts: number;
    logs: number;
    mockData: number;
  };
  preserved: {
    paperlessDocuments: true;
    paperlessTaxonomies: true;
    settings: true;
    users: true;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonArray<T>(filePath: string, data: T[]): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Granular reset helpers
// ---------------------------------------------------------------------------

async function resetAiAnalyses(): Promise<number> {
  const file = path.join(getAiDataDir(), "analyses.json");
  type Item = { id: string; status: string };
  const all = await readJsonArray<Item>(file);
  const initial = all.length;
  await writeJsonArray(file, []);
  return initial;
}

async function resetDetectedInfos(): Promise<number> {
  const file = path.join(getAiDataDir(), "detected-infos.json");
  type Item = { id: string };
  const all = await readJsonArray<Item>(file);
  const initial = all.length;
  await writeJsonArray(file, []);
  return initial;
}

async function resetCorrectionMemory(): Promise<number> {
  const file = path.join(getAiDataDir(), "correction-memory.json");
  type Item = { id: string };
  const all = await readJsonArray<Item>(file);
  const initial = all.length;
  await writeJsonArray(file, []);
  return initial;
}

/**
 * Supprime uniquement les lignes budget générées par IA non encore validées.
 * Les lignes validées (paid / partially_paid / validationStatus === "validated") sont conservées.
 */
async function resetBudgetDrafts(): Promise<number> {
  const file = path.join(getBudgetDataDir(), "financial-items.json");
  type Item = {
    id: string;
    validationStatus?: string;
    status?: string;
    createdFrom?: string;
  };
  const all = await readJsonArray<Item>(file);
  const kept = all.filter((item) => {
    const isValidated =
      item.validationStatus === "validated" ||
      item.status === "paid" ||
      item.status === "partially_paid";
    return isValidated;
  });
  const deleted = all.length - kept.length;
  if (deleted > 0) await writeJsonArray(file, kept);
  return deleted;
}

/**
 * Supprime uniquement les actions générées par IA non terminées.
 * Les actions manuelles et les actions terminées (done/cancelled) sont conservées.
 */
async function resetActionDrafts(): Promise<number> {
  const actionsFile = path.join(getActionsDataDir(), "actions.json");
  type ActionItem = {
    id: string;
    createdFrom?: string;
    status?: string;
  };
  const allActions = await readJsonArray<ActionItem>(actionsFile);
  const keptActions = allActions.filter(
    (item) =>
      item.createdFrom !== "ai" ||
      item.status === "done" ||
      item.status === "cancelled",
  );
  const deletedActions = allActions.length - keptActions.length;
  if (deletedActions > 0) await writeJsonArray(actionsFile, keptActions);

  // Rappels liés uniquement aux actions supprimées (IA, non terminés)
  const remindersFile = path.join(getActionsDataDir(), "reminders.json");
  type ReminderItem = {
    id: string;
    status?: string;
    actionId?: string | null;
  };
  const removedActionIds = new Set(
    allActions
      .filter(
        (item) =>
          item.createdFrom === "ai" &&
          item.status !== "done" &&
          item.status !== "cancelled",
      )
      .map((item) => item.id),
  );
  const allReminders = await readJsonArray<ReminderItem>(remindersFile);
  const keptReminders = allReminders.filter(
    (r) =>
      !r.actionId ||
      !removedActionIds.has(r.actionId) ||
      r.status === "done",
  );
  const deletedReminders = allReminders.length - keptReminders.length;
  if (deletedReminders > 0) await writeJsonArray(remindersFile, keptReminders);

  return deletedActions + deletedReminders;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export async function resetGedInternalHistory(
  options: ResetOptions = {},
): Promise<ResetResult> {
  const {
    resetAiHistory = true,
    resetDetectedInfos: doDetectedInfos = true,
    resetCorrectionMemory: doCorrectionMemory = true,
    resetBudgetDrafts: doBudgetDrafts = true,
    resetActionDrafts: doActionDrafts = true,
  } = options;

  const deleted = {
    aiAnalyses: 0,
    detectedInfos: 0,
    entitySuggestions: 0,
    correctionMemory: 0,
    budgetDrafts: 0,
    actionDrafts: 0,
    logs: 0,
    mockData: 0,
  };

  if (resetAiHistory) {
    deleted.aiAnalyses = await resetAiAnalyses();
  }

  if (doDetectedInfos) {
    deleted.detectedInfos = await resetDetectedInfos();
  }

  if (doCorrectionMemory) {
    deleted.correctionMemory = await resetCorrectionMemory();
  }

  if (doBudgetDrafts) {
    deleted.budgetDrafts = await resetBudgetDrafts();
  }

  if (doActionDrafts) {
    deleted.actionDrafts = await resetActionDrafts();
  }

  return {
    ok: true,
    deleted,
    preserved: {
      paperlessDocuments: true,
      paperlessTaxonomies: true,
      settings: true,
      users: true,
    },
  };
}
