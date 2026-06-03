import "server-only";

import { cleanupDocumentData, type CleanupReport } from "./cleanup-document-data";

export type DeleteLinkedRecordsOptions = {
  deleteAiAnalyses?: boolean;
  deleteDetectedInfos?: boolean;
  deleteFinancialEntries?: boolean;
  deleteBudgetEntries?: boolean;
  deleteActionSuggestions?: boolean;
  deleteReminderSuggestions?: boolean;
  preserveValidatedUserCorrections?: boolean;
};

export type DeleteLinkedRecordsResult = {
  documentId: number;
  deleted: {
    aiAnalyses: number;
    detectedInfos: number;
    financialEntries: number;
    actionSuggestions: number;
    reminders: number;
  };
  detached: {
    financialEntries: number;
    actions: number;
    reminders: number;
  };
};

/**
 * Supprime tous les enregistrements internes GED liés à un document.
 * Délègue à cleanupDocumentData() — source de vérité unique.
 *
 * Règles conservées :
 *  - FinancialItem validé (paid / partially_paid / validationStatus=validated) → détaché
 *  - FinancialItem brouillon → supprimé
 *  - Action manuelle ou terminée → détachée
 *  - Action IA ouverte → supprimée
 *  - Reminder terminé → détaché
 *  - Reminder ouvert → supprimé
 */
export async function deleteLinkedRecordsForDocument(
  documentId: number,
  options: DeleteLinkedRecordsOptions = {},
): Promise<DeleteLinkedRecordsResult> {
  const report: CleanupReport = await cleanupDocumentData(documentId, {
    forceDeleteValidated: !options.preserveValidatedUserCorrections,
  });

  return {
    documentId,
    deleted: {
      aiAnalyses: report.aiAnalysesDeleted,
      detectedInfos: report.detectedInfosDeleted,
      financialEntries: report.financialItemsDeleted,
      actionSuggestions: report.actionsDeleted,
      reminders: report.remindersDeleted,
    },
    detached: {
      financialEntries: report.financialItemsDetached,
      actions: report.actionsDetached,
      reminders: report.remindersDetached,
    },
  };
}
