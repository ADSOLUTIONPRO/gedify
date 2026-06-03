import "server-only";

import { listDetectedInfos, deleteDetectedInfo } from "@/lib/ai/detected-info-store";
import { listAnalyses, deleteAnalysis } from "@/lib/ai/ai-analysis-store";
import { listActions, deleteAction, updateAction } from "@/lib/actions/action-store";
import { listReminders, deleteReminder, updateReminder } from "@/lib/actions/reminder-store";
import { listFinancialItems, deleteFinancialItem, updateFinancialItem } from "@/lib/budget/financial-item-store";

export type CleanupReport = {
  detectedInfosDeleted: number;
  aiAnalysesDeleted: number;
  financialItemsDeleted: number;
  financialItemsDetached: number;
  actionsDeleted: number;
  actionsDetached: number;
  remindersDeleted: number;
  remindersDetached: number;
};

type CleanupOptions = {
  /** If true, also delete validated/confirmed items. Default: false (detach instead). */
  forceDeleteValidated?: boolean;
};

/**
 * Supprime ou détache toutes les données locales liées à un document.
 * Règle :
 *   - Données IA non validées → supprimées
 *   - Suggestions / analyses → supprimées
 *   - FinancialItem validé → détaché (sourceDocumentId = null) avec note
 *   - FinancialItem non validé (suggested/pending) → supprimé
 *   - Action IA non validée (todo/overdue + createdFrom=ai) → supprimée
 *   - Action validée (done) ou manuelle → détachée
 *   - Reminder non terminé lié au document → supprimé
 *   - Reminder terminé → détaché
 */
export async function cleanupDocumentData(
  documentId: number,
  options: CleanupOptions = {},
): Promise<CleanupReport> {
  const report: CleanupReport = {
    detectedInfosDeleted: 0,
    aiAnalysesDeleted: 0,
    financialItemsDeleted: 0,
    financialItemsDetached: 0,
    actionsDeleted: 0,
    actionsDetached: 0,
    remindersDeleted: 0,
    remindersDetached: 0,
  };

  // 1. Detected infos — toujours supprimer (aucune valeur après suppression doc)
  const infos = await listDetectedInfos({ documentId });
  for (const info of infos) {
    await deleteDetectedInfo(info.id);
    report.detectedInfosDeleted++;
  }

  // 2. AI analyses — toujours supprimer
  const analyses = await listAnalyses({ documentId });
  for (const analysis of analyses) {
    await deleteAnalysis(analysis.id);
    report.aiAnalysesDeleted++;
  }

  // 3. Financial items
  const financialItems = await listFinancialItems({ documentId });
  for (const item of financialItems) {
    const isValidated =
      item.validationStatus === "validated" ||
      item.status === "paid" ||
      item.status === "partially_paid";

    if (isValidated && !options.forceDeleteValidated) {
      // Détacher : retirer le lien document, conserver la ligne
      await updateFinancialItem(item.id, {
        sourceDocumentId: null,
        sourceDocumentTitle: `[document supprimé #${documentId}]`,
        sourceAnalysisId: null,
      });
      report.financialItemsDetached++;
    } else {
      await deleteFinancialItem(item.id);
      report.financialItemsDeleted++;
    }
  }

  // 4. Actions
  const actions = await listActions({ documentId });
  for (const action of actions) {
    const isDone = action.status === "done" || action.status === "cancelled";
    const isManual = action.createdFrom === "manual";

    if ((isDone || isManual) && !options.forceDeleteValidated) {
      // Détacher : retirer ce document de la liste documentIds
      const newDocIds = action.documentIds.filter((id) => id !== documentId);
      await updateAction(action.id, { documentIds: newDocIds });
      report.actionsDetached++;
    } else {
      await deleteAction(action.id);
      report.actionsDeleted++;
    }
  }

  // 5. Reminders
  const allReminders = await listReminders();
  const docReminders = allReminders.filter((r) => r.documentId === documentId);
  for (const reminder of docReminders) {
    const isDone = reminder.status === "done" || reminder.status === "cancelled";

    if (isDone && !options.forceDeleteValidated) {
      // Détacher
      await updateReminder(reminder.id, { documentId: null } as Parameters<typeof updateReminder>[1]);
      report.remindersDetached++;
    } else {
      await deleteReminder(reminder.id);
      report.remindersDeleted++;
    }
  }

  return report;
}
