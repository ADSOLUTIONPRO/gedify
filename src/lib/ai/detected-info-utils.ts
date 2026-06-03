import "server-only";

import type { AIAnalysis } from "./types";
import type { DetectedInfoInput } from "./detected-info-types";

/**
 * Convert a fresh AIAnalysis into a list of DetectedInfo candidates ready to be
 * upserted (the store will skip entries whose previous version was edited/validated).
 */
export function synthesizeDetectedInfos(analysis: AIAnalysis): DetectedInfoInput[] {
  const items: DetectedInfoInput[] = [];
  const baseSource: Pick<DetectedInfoInput, "sourceDocumentId" | "sourceAnalysisId" | "confidence" | "source"> = {
    sourceDocumentId: analysis.documentId,
    sourceAnalysisId: analysis.id,
    confidence: analysis.confidence,
    source: "ai",
  };

  // Amounts
  analysis.detectedAmounts.forEach((amount, index) => {
    items.push({
      ...baseSource,
      kind: "amount",
      label: amount.label || "Montant",
      value: `${amount.amount.toFixed(2)} ${amount.currency}`,
      amount: amount.amount,
      currency: amount.currency,
      fieldKey: `amount-${index}`,
    });
  });

  // Dates
  analysis.detectedDates.forEach((date, index) => {
    const isDue = /échéance|limite|à payer/i.test(date.label);
    const isPayment = /paiement|payée/i.test(date.label);
    items.push({
      ...baseSource,
      kind: isDue ? "due_date" : isPayment ? "payment_date" : "document_date",
      label: date.label || "Date",
      value: date.date,
      dateValue: date.iso,
      fieldKey: `date-${index}`,
    });
  });

  // References (with smarter kind inference)
  analysis.detectedReferences.forEach((ref, index) => {
    const lower = ref.label.toLowerCase();
    const kind =
      lower.includes("facture") || lower.includes("invoice")
        ? "invoice_number"
        : lower.includes("client")
          ? "customer_number"
          : lower.includes("contrat")
            ? "contract_number"
            : "reference";
    items.push({
      ...baseSource,
      kind,
      label: ref.label || "Référence",
      value: ref.value,
      referenceValue: ref.value,
      fieldKey: `ref-${index}`,
    });
  });

  // Organizations
  analysis.detectedOrganizations.forEach((org, index) => {
    items.push({
      ...baseSource,
      kind: "organization",
      label: "Organisme détecté",
      value: org,
      textValue: org,
      fieldKey: `org-${index}`,
    });
  });

  // People
  analysis.detectedPeople.forEach((person, index) => {
    items.push({
      ...baseSource,
      kind: "person",
      label: "Personne",
      value: person,
      textValue: person,
      fieldKey: `person-${index}`,
    });
  });

  // Suggested correspondent
  if (analysis.suggestedCorrespondentName) {
    items.push({
      ...baseSource,
      kind: "correspondent",
      label: "Correspondant suggéré",
      value: analysis.suggestedCorrespondentName,
      textValue: analysis.suggestedCorrespondentName,
      correspondentId: analysis.suggestedCorrespondentId,
      correspondentName: analysis.suggestedCorrespondentName,
      fieldKey: "correspondent-suggested",
    });
  }

  // Document kind / type
  if (analysis.detectedDocumentKind) {
    items.push({
      ...baseSource,
      kind: "financial_type",
      label: "Nature du document",
      value: analysis.detectedDocumentKind,
      textValue: analysis.detectedDocumentKind,
      fieldKey: "kind-detected",
    });
  }

  // Financial impacts (kind/category)
  analysis.financialImpact.forEach((impact, index) => {
    items.push({
      ...baseSource,
      kind: "category",
      label: "Catégorie suggérée",
      value: impact.category ?? impact.kind,
      textValue: impact.category ?? impact.kind,
      fieldKey: `category-${index}`,
    });
  });

  return items;
}
