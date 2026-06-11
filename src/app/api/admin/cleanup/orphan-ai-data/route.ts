import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { listDetectedInfos, deleteDetectedInfo } from "@/lib/ai/detected-info-store";
import { listAnalyses, deleteAnalysis } from "@/lib/ai/ai-analysis-store";
import { listActions, deleteAction } from "@/lib/actions/action-store";
import { listReminders, deleteReminder } from "@/lib/actions/reminder-store";
import { listFinancialItems, deleteFinancialItem } from "@/lib/budget/financial-item-store";
import { paperlessFetch } from "@/lib/paperless";
import type { PaperlessListResponse, PaperlessDocument } from "@/lib/paperless-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrphanReport = {
  ok: true;
  deleted: {
    detectedInfos: number;
    aiAnalyses: number;
    financialItems: number;
    actions: number;
    reminders: number;
  };
  checkedDocumentIds: number;
};

/** Fetches all document IDs from Gedify (up to 5000). */
async function fetchAllPaperlessIds(): Promise<Set<number>> {
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
        for (const doc of result.value.results ?? []) {
          ids.add(Number(doc.id));
        }
      }
    }
  } catch {
    // Gedify unreachable — return empty set to be safe (won't delete anything)
  }
  return ids;
}

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  const g = await (await import("@/lib/saas/admin-guards")).denyGlobalAdminForTenant("cleanup-orphan-ai"); if (g) return g;

  try {
    const existingIds = await fetchAllPaperlessIds();

    // If Gedify is unreachable, refuse to run cleanup (safer)
    if (existingIds.size === 0) {
      return NextResponse.json(
        {
          error:
            "Impossible de contacter Gedify pour vérifier les IDs existants. Nettoyage annulé pour éviter toute perte de données.",
        },
        { status: 503 },
      );
    }

    const deleted = {
      detectedInfos: 0,
      aiAnalyses: 0,
      financialItems: 0,
      actions: 0,
      reminders: 0,
    };

    // 1. Detected infos orphelines
    const allInfos = await listDetectedInfos();
    for (const info of allInfos) {
      if (info.sourceDocumentId == null) continue;
      if (!existingIds.has(info.sourceDocumentId)) {
        await deleteDetectedInfo(info.id);
        deleted.detectedInfos++;
      }
    }

    // 2. Analyses IA orphelines
    const allAnalyses = await listAnalyses();
    for (const analysis of allAnalyses) {
      if (!analysis.documentId) continue;
      if (!existingIds.has(analysis.documentId)) {
        await deleteAnalysis(analysis.id);
        deleted.aiAnalyses++;
      }
    }

    // 3. Financial items non validés orphelins
    const allItems = await listFinancialItems();
    for (const item of allItems) {
      if (item.sourceDocumentId == null) continue;
      if (!existingIds.has(item.sourceDocumentId)) {
        const isValidated =
          item.validationStatus === "validated" ||
          item.status === "paid" ||
          item.status === "partially_paid";
        if (!isValidated) {
          await deleteFinancialItem(item.id);
          deleted.financialItems++;
        }
      }
    }

    // 4. Actions IA non validées orphelines
    const allActions = await listActions();
    for (const action of allActions) {
      if (action.documentIds.length === 0) continue;
      // Only remove orphan if ALL linked documents are gone and action is AI-generated
      const allDocsMissing = action.documentIds.every((id) => !existingIds.has(id));
      if (allDocsMissing && action.createdFrom === "ai" && action.status !== "done") {
        await deleteAction(action.id);
        deleted.actions++;
      }
    }

    // 5. Reminders non terminés orphelins
    const allReminders = await listReminders();
    for (const reminder of allReminders) {
      if (reminder.documentId == null) continue;
      if (!existingIds.has(reminder.documentId) && reminder.status === "scheduled") {
        await deleteReminder(reminder.id);
        deleted.reminders++;
      }
    }

    const report: OrphanReport = {
      ok: true,
      deleted,
      checkedDocumentIds: existingIds.size,
    };

    return NextResponse.json(report);
  } catch (error) {
    return jsonError("Erreur lors du nettoyage des données orphelines", error);
  }
}
