import "server-only";

import type { AnalyzeContext, AnalyzeResult } from "./ai-provider";
import { validateAIAnalysisConsistency } from "./rules/validate-analysis-consistency";
import { sanitizeFinalAnalysis } from "./rules/final-analysis-sanitizer";
import { classifyDocumentFromOCR } from "./rules/document-classification-engine";
import { extractDocumentFields } from "./rules/field-extractors";
import { normalizeTags, removeTags } from "./rules/tag-normalizer";
import { FORBIDDEN_TAGS_BY_KIND, REQUIRED_TAGS_BY_KIND } from "./rules/rule-conflict-resolver";
import type { AIDetectedAmount, AIFinancialImpact, AIRecommendedAction, AIUrgency } from "./types";

// Re-use the mock provider's rule engine — it runs entirely locally in <1s.
async function runLocalRules(context: AnalyzeContext): Promise<AnalyzeResult> {
  const { getLocalRulesProvider } = await import("./ai-provider");
  return getLocalRulesProvider().analyzeDocument(context);
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export type FastAnalysisResult = {
  ok: true;
  mode: "local-rules";
  durationMs: number;
  result: AnalyzeResult;
};

export type FastAnalysisError = {
  ok: false;
  mode: "local-rules";
  durationMs: number;
  error: string;
};

/**
 * Fast document analysis using ONLY local business rules.
 *
 * Pipeline:
 *  1. Run mock provider rules (amount/date/reference extraction)
 *  2. Run classification engine (15 doc types, priority-based)
 *  3. Run field extractors (pay slip, invoice, demand letter, bank)
 *  4. Apply consistency validation + tag normalization
 *  5. Apply final sanitizer (remove contradictions)
 *
 * No network, no AI model. Returns in < 200ms for typical documents.
 * provider = "local-rules"
 */
export async function fastAnalyzeDocument(
  context: AnalyzeContext
): Promise<FastAnalysisResult | FastAnalysisError> {
  const start = Date.now();
  try {
    const ocr = context.content ?? "";

    // ── Step 1: Mock provider (amounts/dates/refs extraction) ─────────────
    const raw = await runLocalRules(context);

    // ── Step 2: Classification engine ─────────────────────────────────────
    const classification = classifyDocumentFromOCR(ocr, context.title);

    if (classification) {
      // Override kind and type from classification engine
      raw.detectedDocumentKind = classification.documentTypeName;
      raw.suggestedDocumentTypeName = classification.documentTypeName;

      // Override tags with classification engine result
      const baseTags = classification.tags;
      const forbidden = new Set(FORBIDDEN_TAGS_BY_KIND[classification.kind] ?? []);
      const required = REQUIRED_TAGS_BY_KIND[classification.kind] ?? [];
      const currentTags = (raw.suggestedTagNames ?? []).filter((t) => !forbidden.has(t));
      raw.suggestedTagNames = normalizeTags([...baseTags, ...currentTags, ...required]);

      // Override correspondent hint if classification found one and mock didn't
      if (classification.correspondentHint && !raw.suggestedCorrespondentName) {
        raw.suggestedCorrespondentName = classification.correspondentHint;
      }

      // Override urgency if classification has stronger signal
      if (
        classification.defaultUrgency === "urgent" ||
        (classification.defaultUrgency === "important" && raw.urgency === "normal")
      ) {
        raw.urgency = classification.defaultUrgency as AIUrgency;
      }
    }

    // ── Step 3: Field extraction ──────────────────────────────────────────
    if (classification) {
      const fields = extractDocumentFields(classification.kind, ocr);

      if (fields.kind === "pay_slip") {
        // Enrich with local pay slip extraction
        if (fields.employerName && !raw.suggestedCorrespondentName) {
          raw.suggestedCorrespondentName = fields.employerName;
        }
        if (fields.netToPay != null) {
          // Ensure net à payer is the primary amount in financialImpact
          const netEntry: AIFinancialImpact = {
            kind: "income",
            amount: fields.netToPay,
            currency: "EUR",
            dueDate: null,
            category: "salaire",
            confidence: "medium",
          };
          if (raw.financialImpact.length === 0) {
            raw.financialImpact = [netEntry];
          } else {
            raw.financialImpact = [netEntry, ...raw.financialImpact.filter((fi) => fi.kind !== "income")];
          }
        }
        if (fields.netToPay != null && raw.detectedAmounts.length === 0) {
          const netAmount: AIDetectedAmount = {
            label: "Net à payer",
            amount: fields.netToPay,
            currency: "EUR",
          };
          raw.detectedAmounts = [netAmount];
        }
        if (fields.employerSiret) {
          raw.detectedReferences = [
            ...raw.detectedReferences,
            { label: "SIRET employeur", value: fields.employerSiret },
          ];
        }
      } else if (fields.kind === "invoice") {
        if (fields.totalTTC != null && raw.financialImpact.length === 0) {
          raw.financialImpact = [{
            kind: "invoice",
            amount: fields.totalTTC,
            currency: "EUR",
            dueDate: fields.dueDate ?? null,
            creditor: raw.suggestedCorrespondentName ?? undefined,
            category: "dépense",
            confidence: "medium",
          }];
        }
        if (fields.invoiceNumber) {
          raw.detectedReferences = [
            ...raw.detectedReferences,
            { label: "Numéro facture", value: fields.invoiceNumber },
          ];
        }
        if (fields.iban) {
          raw.detectedReferences = [
            ...raw.detectedReferences,
            { label: "IBAN", value: fields.iban },
          ];
        }
      } else if (fields.kind === "demand_letter") {
        raw.urgency = fields.urgencyLevel as AIUrgency;
        if (fields.amountDue != null && raw.financialImpact.length === 0) {
          raw.financialImpact = [{
            kind: "debt",
            amount: fields.amountDue,
            currency: "EUR",
            dueDate: fields.dueDate ?? null,
            confidence: "medium",
          }];
        }
        const actions: AIRecommendedAction[] = [{
          id: shortId(),
          type: fields.hasBailiffThreat ? "pay" : "verify",
          title: fields.hasBailiffThreat
            ? "Régler ce montant en urgence"
            : "Vérifier et traiter cette relance",
          description: fields.hasProsecutionThreat
            ? "Procédure judiciaire mentionnée — consulter un professionnel si nécessaire."
            : "Vérifier le montant dû et contacter le créancier.",
          dueDate: fields.dueDate ?? null,
          amount: fields.amountDue ?? null,
          priority: fields.urgencyLevel === "urgent" ? "urgent" : "high",
        }];
        if (raw.recommendedActions.length === 0) {
          raw.recommendedActions = actions;
        }
      }
    }

    // ── Step 4: Consistency validation + tag correction ───────────────────
    const consistency = validateAIAnalysisConsistency(
      raw,
      ocr,
      context.fileName ?? null
    );

    // ── Step 5: Final sanitizer ────────────────────────────────────────────
    const result: AnalyzeResult = sanitizeFinalAnalysis({
      ...consistency.correctedAnalysis,
      provider: "local-rules",
      // Remove forbidden tags one final time
      suggestedTagNames: removeTags(
        normalizeTags(consistency.correctedAnalysis.suggestedTagNames ?? []),
        Array.from(new Set(
          Object.values(FORBIDDEN_TAGS_BY_KIND).flat()
        )).filter((tag) => {
          // Only remove tags forbidden for the CURRENT document type
          if (!classification) return false;
          return (FORBIDDEN_TAGS_BY_KIND[classification.kind] ?? []).includes(tag);
        })
      ),
    });

    const durationMs = Date.now() - start;
    console.log(
      `[AI_PIPELINE] fastAnalysis durationMs=${durationMs} docId=${context.documentId} kind=${result.detectedDocumentKind} confidence=${result.confidence} tags=${result.suggestedTagNames?.join(",")}`
    );
    return { ok: true, mode: "local-rules", durationMs, result };
  } catch (err) {
    const durationMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[AI_PIPELINE] fastAnalysis error durationMs=${durationMs} docId=${context.documentId}: ${error}`);
    return { ok: false, mode: "local-rules", durationMs, error };
  }
}
