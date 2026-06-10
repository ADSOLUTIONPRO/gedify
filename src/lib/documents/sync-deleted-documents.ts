import "server-only";

import { listAnalyses } from "@/lib/ai/ai-analysis-store";
import { listDetectedInfos } from "@/lib/ai/detected-info-store";
import { listFinancialItems } from "@/lib/budget/financial-item-store";
import { listActions } from "@/lib/actions/action-store";
import { paperlessFetch } from "@/lib/paperless";
import type { PaperlessListResponse, PaperlessDocument } from "@/lib/paperless-types";
import { cleanupDocumentData } from "./cleanup-document-data";

export type SyncReport = {
  checkedDocumentIds: number;
  deletedInPaperless: number[];
  cleaned: {
    aiAnalyses: number;
    detectedInfos: number;
    financialItemsDeleted: number;
    financialItemsDetached: number;
    actionsDeleted: number;
    actionsDetached: number;
    remindersDeleted: number;
    remindersDetached: number;
  };
};

/**
 * Récupère tous les document IDs connus dans Gedify, vérifie leur existence
 * côté Paperless et nettoie les données liées aux documents introuvables.
 */
export async function syncDeletedPaperlessDocuments(): Promise<SyncReport> {
  const report: SyncReport = {
    checkedDocumentIds: 0,
    deletedInPaperless: [],
    cleaned: {
      aiAnalyses: 0,
      detectedInfos: 0,
      financialItemsDeleted: 0,
      financialItemsDetached: 0,
      actionsDeleted: 0,
      actionsDetached: 0,
      remindersDeleted: 0,
      remindersDetached: 0,
    },
  };

  // 1. Collecter tous les IDs connus dans Gedify
  const [analyses, detectedInfos, financialItems, actions] = await Promise.all([
    listAnalyses(),
    listDetectedInfos(),
    listFinancialItems(),
    listActions(),
  ]);

  const knownIds = new Set<number>();
  for (const a of analyses) if (a.documentId) knownIds.add(a.documentId);
  for (const d of detectedInfos) if (d.sourceDocumentId) knownIds.add(d.sourceDocumentId);
  for (const f of financialItems) if (f.sourceDocumentId) knownIds.add(f.sourceDocumentId);
  for (const ac of actions) for (const id of ac.documentIds) knownIds.add(id);

  report.checkedDocumentIds = knownIds.size;
  if (knownIds.size === 0) return report;

  // 2. Récupérer les IDs existants côté Paperless
  const existingIds = await fetchPaperlessIds();

  // 3. Identifier les IDs supprimés
  const deletedIds = [...knownIds].filter((id) => !existingIds.has(id));
  report.deletedInPaperless = deletedIds;

  // 4. Nettoyer les données liées
  for (const documentId of deletedIds) {
    const cleanup = await cleanupDocumentData(documentId);
    report.cleaned.aiAnalyses += cleanup.aiAnalysesDeleted;
    report.cleaned.detectedInfos += cleanup.detectedInfosDeleted;
    report.cleaned.financialItemsDeleted += cleanup.financialItemsDeleted;
    report.cleaned.financialItemsDetached += cleanup.financialItemsDetached;
    report.cleaned.actionsDeleted += cleanup.actionsDeleted;
    report.cleaned.actionsDetached += cleanup.actionsDetached;
    report.cleaned.remindersDeleted += cleanup.remindersDeleted;
    report.cleaned.remindersDetached += cleanup.remindersDetached;
  }

  return report;
}

async function fetchPaperlessIds(): Promise<Set<number>> {
  const ids = new Set<number>();
  try {
    const first = await paperlessFetch<PaperlessListResponse<PaperlessDocument>>(
      "/api/documents/",
      { searchParams: { page_size: 1, fields: "id" } },
    );
    const total = first.count ?? 0;
    if (total === 0) return ids;

    const pageSize = 100;
    const pages = Math.ceil(Math.min(total, 5000) / pageSize);
    const results = await Promise.allSettled(
      Array.from({ length: pages }, (_, i) =>
        paperlessFetch<PaperlessListResponse<PaperlessDocument>>("/api/documents/", {
          searchParams: { page_size: pageSize, page: i + 1, fields: "id" },
        }),
      ),
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const doc of result.value.results ?? []) ids.add(Number(doc.id));
      }
    }
  } catch {
    // Paperless injoignable — retourner ensemble vide (ne supprimera rien)
  }
  return ids;
}
