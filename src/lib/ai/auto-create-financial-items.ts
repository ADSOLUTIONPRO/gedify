import "server-only";

import type { AIAnalysis } from "./types";
import { mapImpactToCandidate } from "@/lib/budget/financial-extraction-mapper";
import {
  createFinancialItem,
  listFinancialItems,
} from "@/lib/budget/financial-item-store";
import type { FinancialItem } from "@/lib/budget/financial-item-types";
import { getPaperlessPublicUrl } from "@/lib/paperless";

const INCOME_KINDS = new Set<string>(["income", "allowance", "benefit", "refund", "credit"]);

/** Le document est-il un bulletin de salaire / une fiche de paie ? */
function isSalaryDocument(analysis: AIAnalysis): boolean {
  const txt = `${analysis.detectedDocumentKind ?? ""} ${analysis.suggestedDocumentTypeName ?? ""}`.toLowerCase();
  if (/salaire|paie|bulletin|fiche de paie|r[ée]mun[ée]ration/.test(txt)) return true;
  return (analysis.financialImpact ?? []).some(
    (i) => i.kind === "income" && /salaire|paie/i.test(i.category ?? ""),
  );
}

/**
 * Sélectionne LE SEUL montant budgétaire PRINCIPAL d'un document.
 *
 * Règle produit : on ne crée jamais une ligne par montant détecté. On retient :
 *  - bulletin de salaire → le NET À PAYER (≈ le plus petit des montants « net »,
 *    car net après impôt < net imposable < brut) ;
 *  - facture / relance / avis → le TOTAL TTC / NET À PAYER / SOLDE DÛ (≈ le plus
 *    grand montant à régler, jamais HT/TVA/lignes de détail).
 *
 * Idéalement le prompt IA ne renvoie déjà qu'un seul `financialImpact` ; cette
 * fonction est le FILET DE SÉCURITÉ déterministe si plusieurs sont renvoyés.
 */
function selectPrimaryImpact(analysis: AIAnalysis): AIAnalysis["financialImpact"][number] | null {
  const impacts = (analysis.financialImpact ?? []).filter((i) => Number.isFinite(i.amount) && Math.abs(i.amount) > 0.005);
  if (impacts.length === 0) return null;
  if (impacts.length === 1) return impacts[0];

  if (isSalaryDocument(analysis)) {
    const incomes = impacts.filter((i) => INCOME_KINDS.has(i.kind));
    const pool = incomes.length ? incomes : impacts;
    // Net à payer (réellement versé) = le plus petit montant net positif.
    return pool.reduce((best, i) => (i.amount < best.amount ? i : best));
  }

  // Facture / relance : le total TTC à régler est le plus grand montant.
  const expenses = impacts.filter((i) => !INCOME_KINDS.has(i.kind));
  const pool = expenses.length ? expenses : impacts;
  return pool.reduce((best, i) => (i.amount > best.amount ? i : best));
}

/**
 * Crée AU PLUS UNE ligne financière (le montant principal) à partir de l'analyse,
 * en `needs_review` si ambiguïté/faible confiance. Les montants secondaires
 * restent dans la fiche IA (detectedAmounts) mais NE sont PAS envoyés au budget.
 *
 * User-owned items (validated / converted_*) are never replaced.
 */
export async function autoCreateFinancialItemsFromAnalysis(
  analysis: AIAnalysis,
  options: { documentTitle?: string | null } = {},
): Promise<{ created: FinancialItem[]; skipped: number }> {
  const primary = selectPrimaryImpact(analysis);
  if (!primary) return { created: [], skipped: 0 };

  const existing = await listFinancialItems({ analysisId: analysis.id });
  const baseUrl = getPaperlessPublicUrl();

  // Évite les doublons sur ré-analyse + ne touche jamais une ligne validée par l'utilisateur.
  const previous = existing.find(
    (entry) => Math.abs(entry.amount - primary.amount) < 0.005 && entry.sourceAnalysisId === analysis.id,
  );
  if (previous) {
    const userOwned =
      previous.validationStatus === "validated" ||
      previous.validationStatus === "ignored" ||
      previous.validationStatus === "rejected" ||
      previous.status === "paid" ||
      previous.status === "ignored" ||
      previous.status === "cancelled";
    if (userOwned) return { created: [], skipped: 1 };
  }

  const candidate = mapImpactToCandidate(analysis, primary, {
    paperlessBaseUrl: baseUrl,
    documentTitle: options.documentTitle ?? null,
  });

  // Ambiguïté (plusieurs montants concurrents) → toujours « à vérifier » : on ne
  // valide jamais automatiquement quand l'IA hésitait.
  const ambiguous = (analysis.financialImpact?.length ?? 0) > 1;
  const item = await createFinancialItem({
    ...candidate,
    ...(ambiguous ? { validationStatus: "needs_review" as const, status: "to_review" as const } : {}),
    isAiDetected: true,
  });

  return { created: [item], skipped: 0 };
}
