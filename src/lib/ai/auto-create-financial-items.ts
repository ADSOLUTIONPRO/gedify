import "server-only";

import type { AIAnalysis } from "./types";
import { mapImpactToCandidate } from "@/lib/budget/financial-extraction-mapper";
import {
  createFinancialItem,
  listFinancialItems,
} from "@/lib/budget/financial-item-store";
import type { FinancialItem } from "@/lib/budget/financial-item-types";
import { getPaperlessPublicUrl } from "@/lib/paperless";

/**
 * For each financial impact in the analysis, create (or replace pending) a FinancialItem
 * tagged `validationStatus = needs_review` / `status = to_review`.
 *
 * User-owned items (validated / converted_*) are never replaced.
 */
export async function autoCreateFinancialItemsFromAnalysis(
  analysis: AIAnalysis,
  options: { documentTitle?: string | null } = {},
): Promise<{ created: FinancialItem[]; skipped: number }> {
  if (!analysis.financialImpact || analysis.financialImpact.length === 0) {
    return { created: [], skipped: 0 };
  }

  // Look at existing items linked to this analysis to avoid duplicates.
  const existing = await listFinancialItems({ analysisId: analysis.id });
  const baseUrl = getPaperlessPublicUrl();
  const created: FinancialItem[] = [];
  let skipped = 0;

  for (let index = 0; index < analysis.financialImpact.length; index += 1) {
    const impact = analysis.financialImpact[index];
    // Match an existing entry by analysisId + amount + kind.
    const previous = existing.find(
      (entry) =>
        Math.abs(entry.amount - impact.amount) < 0.005 &&
        entry.sourceAnalysisId === analysis.id,
    );

    if (previous) {
      const userOwned =
        previous.validationStatus === "validated" ||
        previous.validationStatus === "ignored" ||
        previous.validationStatus === "rejected" ||
        previous.status === "paid" ||
        previous.status === "ignored" ||
        previous.status === "cancelled";
      if (userOwned) {
        skipped += 1;
        continue;
      }
    }

    const candidate = mapImpactToCandidate(analysis, impact, {
      paperlessBaseUrl: baseUrl,
      documentTitle: options.documentTitle ?? null,
    });

    // §19 — conserve le statut/validation cohérents calculés par le mapper
    // (le mapper ne met « à contrôler » que si la confiance est faible).
    const item = await createFinancialItem({
      ...candidate,
      isAiDetected: true,
    });
    created.push(item);
  }

  return { created, skipped };
}
